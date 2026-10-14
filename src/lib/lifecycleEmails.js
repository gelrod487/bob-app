// Automatic emails to customers: a welcome right after sign-up, and a heads-up 48 hours before the
// free trial ends. Each is sent at most once per account: the "sent" timestamp is claimed with an atomic
// UPDATE ... WHERE it is still null BEFORE sending, so a restart, a retry or a second server instance can't
// send a duplicate. If the send fails (or email isn't configured), the claim is released so a later sweep
// retries it. Admin and comped accounts never get these.
const { isAdminEmail, trialEndsAt } = require('../middleware/auth');
const { sendMail } = require('./mailer');
const { welcomeEmail, trialEndingEmail } = require('./emailTemplates');
const founding = require('./founding');

const HOUR = 60 * 60 * 1000;
const TRIAL_ENDING_WINDOW_MS = 48 * HOUR;
const WELCOME_RETRY_MS = 3 * 24 * HOUR;
const SEND_GAP_MS = 600; // stay under Resend's request rate limit

function foundingInfo() { return { enabled: founding.enabled(), percentOff: founding.PERCENT_OFF }; }
function wantsEmail(p) { return !!p && !p.isComped && !isAdminEmail(p.email); }

// Claim -> send -> release on failure. `field` is the Producer column holding the sent-at timestamp.
async function claimAndSend(prisma, producerId, field, build) {
  const claimed = await prisma.producer.updateMany({ where: { id: producerId, [field]: null }, data: { [field]: new Date() } });
  if (claimed.count === 0) return { status: 'already-sent' };
  const release = () => prisma.producer.update({ where: { id: producerId }, data: { [field]: null } }).catch(() => {});
  try {
    const producer = await prisma.producer.findUnique({ where: { id: producerId } });
    if (!wantsEmail(producer)) return { status: 'not-eligible' }; // stays claimed: never retried
    const message = build(producer);
    if (!message) return { status: 'not-needed' };
    const result = await sendMail({ to: producer.email, ...message });
    if (!result.sent) { await release(); return { status: 'skipped' }; } // email isn't configured here
    return { status: 'sent' };
  } catch (err) {
    await release();
    console.error(`[mail] ${field} for producer ${producerId} failed: ${err.message}`);
    return { status: 'failed', error: err.message };
  }
}

function sendWelcome(prisma, producerId) {
  return claimAndSend(prisma, producerId, 'welcomeEmailSentAt', (producer) => {
    const ends = trialEndsAt(producer);
    return welcomeEmail({ producer, trialEndsAt: ends, trialActive: ends > new Date(), founding: foundingInfo() });
  });
}

function sendTrialEnding(prisma, producerId) {
  return claimAndSend(prisma, producerId, 'trialEndingEmailSentAt', (producer) => {
    const ends = trialEndsAt(producer);
    if (producer.subscriptionStatus === 'active' || producer.subscriptionStatus === 'past_due') return null;
    if (ends <= new Date() || ends - new Date() > TRIAL_ENDING_WINDOW_MS) return null; // changed since we looked
    return trialEndingEmail({ producer, trialEndsAt: ends, founding: foundingInfo() });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One pass: trial-ending emails that are due, plus retries of welcome emails that failed in the last 3 days.
async function runSweep(prisma) {
  const now = new Date();
  const trialDays = 14;
  const soon = new Date(now.getTime() + TRIAL_ENDING_WINDOW_MS);
  const defaultCreatedFrom = new Date(now.getTime() - trialDays * 24 * HOUR);
  const defaultCreatedTo = new Date(soon.getTime() - trialDays * 24 * HOUR);

  const ending = await prisma.producer.findMany({
    where: {
      trialEndingEmailSentAt: null,
      isComped: false,
      subscriptionStatus: { notIn: ['active', 'past_due'] },
      OR: [
        { trialEndsAtOverride: { gt: now, lte: soon } },
        { trialEndsAtOverride: null, createdAt: { gt: defaultCreatedFrom, lte: defaultCreatedTo } },
      ],
    },
    select: { id: true, email: true, isComped: true, createdAt: true, trialEndsAtOverride: true },
  });
  const welcomeRetries = await prisma.producer.findMany({
    where: { welcomeEmailSentAt: null, isComped: false, createdAt: { gt: new Date(now.getTime() - WELCOME_RETRY_MS) } },
    select: { id: true, email: true },
  });

  const counts = { welcome: 0, trialEnding: 0 };
  for (const p of welcomeRetries) {
    if (isAdminEmail(p.email)) continue;
    if ((await sendWelcome(prisma, p.id)).status === 'sent') counts.welcome++;
    await sleep(SEND_GAP_MS);
  }
  for (const p of ending) {
    if (isAdminEmail(p.email)) continue;
    const ends = trialEndsAt(p);
    if (ends <= now || ends > soon) continue;
    if ((await sendTrialEnding(prisma, p.id)).status === 'sent') counts.trialEnding++;
    await sleep(SEND_GAP_MS);
  }
  return counts;
}

// Starts the hourly sweep. Does nothing unless email is configured (RESEND_API_KEY), so local dev never
// emails anyone. A sweep that is still running when the next tick fires is skipped.
function startScheduler(prisma) {
  if (!require('./mailer').configured()) {
    console.log('[mail] RESEND_API_KEY not set — lifecycle emails are off.');
    return;
  }
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const c = await runSweep(prisma);
      if (c.welcome || c.trialEnding) console.log(`[mail] sweep sent ${c.welcome} welcome, ${c.trialEnding} trial-ending`);
    } catch (err) {
      console.error('[mail] sweep failed:', err.message);
    } finally { running = false; }
  };
  setTimeout(tick, 60 * 1000).unref();
  setInterval(tick, HOUR).unref();
}

module.exports = { sendWelcome, sendTrialEnding, runSweep, startScheduler };
