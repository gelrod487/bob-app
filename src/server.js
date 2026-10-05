// BOB_ENV_FILE is set only by `npm run dev` (-> .env.dev). Production (Render) never sets
// it and keeps reading real environment variables, with .env as the plain-local fallback.
require('dotenv').config({ path: process.env.BOB_ENV_FILE || '.env' });
if (process.env.BOB_ENV_FILE) require('./lib/devGuard').assertDevEnv();
const path = require('path');
const express = require('express');

const { producerProfitability, agencyProfitability } = require('./lib/profitability');
const prisma = require('./lib/db');
const { requireAuth, requireProducer, requireAdmin, requireActiveOrTrial } = require('./middleware/auth');
const { requireProducerPlusOrAbove } = require('./middleware/tier');
const handleStripeWebhook = require('./routes/billingWebhook');
const asyncHandler = require('./middleware/asyncHandler');
const { securityHeaders } = require('./middleware/securityHeaders');
const { rateLimit } = require('./middleware/rateLimit');

const app = express();
app.use(securityHeaders);

// Dev only: the browser's Supabase client normally has the production project's URL/key
// baked into public/js/supabaseClient.js. When running against the dev project, serve a
// version pointed at the dev project instead (registered before express.static so it wins).
if (process.env.BOB_ENV_FILE) {
  app.get('/js/supabaseClient.js', (req, res) => {
    res.type('application/javascript').send(
      `const SUPABASE_URL = ${JSON.stringify(process.env.SUPABASE_URL.trim())};\n` +
      `const SUPABASE_PUBLISHABLE_KEY = ${JSON.stringify(process.env.SUPABASE_PUBLISHABLE_KEY.trim())};\n` +
      'const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);\n',
    );
  });
}

// Stripe needs the exact raw request body to verify its signature, so this is registered
// BEFORE express.json() below and matched first — it never goes through the JSON parser
// or the Supabase auth middleware (Stripe authenticates via the signature instead).
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

app.use(express.json({ limit: '15mb' })); // generous limit for base64 workbook uploads in /import

// Rate limits. The general one runs before auth so a flood of junk requests is turned away
// before it costs a Supabase lookup; the tighter ones guard the expensive or sensitive routes.
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 400 }));
app.use('/api/import', rateLimit({ windowMs: 10 * 60 * 1000, max: 15, message: 'Too many imports in a short time. Please wait a few minutes and try again.' }));
app.use('/api/billing', rateLimit({ windowMs: 10 * 60 * 1000, max: 30 }));
app.use('/api/admin', rateLimit({ windowMs: 60 * 1000, max: 240 }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Every remaining /api/* route requires a valid Supabase session.
app.use('/api', requireAuth);
// Admin-only read-only "view as user" (header-driven; see the middleware's doc comment).
app.use('/api', require('./middleware/supportView').applySupportView);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/me', require('./routes/me'));
app.use('/api/imos', requireProducer, requireActiveOrTrial, require('./routes/imos'));
app.use('/api/clients', requireProducer, requireActiveOrTrial, require('./routes/clients'));
app.use('/api/policies', requireProducer, requireActiveOrTrial, require('./routes/policies'));
app.use('/api/commission-entries', requireProducer, requireActiveOrTrial, require('./routes/commissionEntries'));
app.use('/api/expenses', requireProducer, requireActiveOrTrial, require('./routes/expenses'));
app.use('/api/payment-reminders', requireProducer, requireActiveOrTrial, require('./routes/paymentReminders'));
app.use('/api/owner-draws', requireProducer, requireActiveOrTrial, require('./routes/ownerDraws'));
app.use('/api/import', requireProducer, requireActiveOrTrial, require('./routes/import'));
// Deliberately no requireActiveOrTrial here — an expired producer must still be able to
// reach checkout-session/portal-session to subscribe and lift their own gate.
app.use('/api/billing', requireProducer, require('./routes/billing'));
app.use('/api/activity', requireProducer, requireActiveOrTrial, require('./routes/activity'));
app.use('/api/goals', requireProducer, requireActiveOrTrial, require('./routes/goals'));
app.use('/api/team-goals', requireProducer, requireActiveOrTrial, require('./routes/teamGoals'));
app.use('/api/team', requireProducer, requireActiveOrTrial, require('./routes/team'));
app.use('/api/commission-schedule', requireProducer, requireActiveOrTrial, require('./routes/commissionSchedule'));
app.use('/api/annuity-commission-schedule', requireProducer, requireActiveOrTrial, require('./routes/annuityCommissionSchedule'));
app.use('/api/analytics', requireProducer, requireActiveOrTrial, requireProducerPlusOrAbove, require('./routes/analytics'));
// Deliberately no requireActiveOrTrial — feedback should stay open even to a producer
// whose trial/subscription lapsed, and it costs nothing to let them keep talking to us.
app.use('/api/suggestions', requireProducer, require('./routes/suggestions'));
app.use('/api/admin', requireAdmin, require('./routes/admin'));

// GET /api/dashboard — the numbers the mockup's dashboard tab needs, in one call.
app.get('/api/dashboard', requireProducer, requireActiveOrTrial, asyncHandler(async (req, res) => {
  const producer = await prisma.producer.findUnique({ where: { id: req.producerId } });
  if (!producer) return res.status(404).json({ error: 'Producer not found.' });

  if (producer.subscriptionTier === 'agency_owner') {
    // Not producer.agencyId — see the Agency model's doc comment. A promoted downline's
    // agencyId is their upline's agency (membership), not the one they themselves own.
    const ownedAgency = await prisma.agency.findUnique({ where: { ownerId: producer.id } });
    if (ownedAgency) {
      const stats = await agencyProfitability(ownedAgency.id, req.query);
      return res.json({ tier: 'agency_owner', ...stats });
    }
  }
  const stats = await producerProfitability(producer.id, req.query);
  res.json({ tier: 'individual', ...stats });
}));

// Final safety net: anything asyncHandler passes to next(err) lands here instead of
// crashing the process (this is what a bad Stripe/Prisma call used to do — see
// src/middleware/asyncHandler.js).
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  // A deliberate error (httpError(): an admin-route conflict, a Stripe outage reported as
  // 502, ...) opts in with expose=true so its message reaches the caller instead of the
  // generic 500 below. Server-side (5xx) ones are still logged.
  if (err.expose === true && err.status >= 400 && err.status < 600) {
    if (err.status >= 500) console.error(err);
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our end.' });
});

// Extra defense-in-depth: if anything still slips through as an unhandled rejection
// (e.g. a background timer callback outside any request, like a retry inside a
// third-party SDK), log it instead of letting Node's default behavior kill the process.
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`BOB backend listening on :${port}`);
  // Record every existing account as having used its trial (no-op once they're all recorded).
  require('./lib/trialUse').backfillTrialUse(prisma)
    .then((n) => { if (n) console.log(`Recorded ${n} existing account(s) as trial-used.`); })
    .catch((err) => console.error('trial-use backfill failed:', err.message));
});
