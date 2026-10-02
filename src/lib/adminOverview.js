const { trialEndsAt, isAdminEmail } = require('../middleware/auth');

const DAY = 24 * 60 * 60 * 1000;

// Start (UTC midnight) of the Monday on/before `date` — buckets signups by week.
function weekStart(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - sinceMonday * DAY);
}

// Business-health numbers for the admin Overview tab, from plain producer rows. Internal
// (ADMIN_EMAILS) accounts are left out — they're BOB's own team, not customers.
//
// Caveat baked into the output: BOB keeps no history of status changes, so "conversion" is
// a snapshot (of trials that have ended, how many are paying now), not time-to-convert.
// And lastSeenAt only started recording when this feature shipped, so earlier activity
// reads as "never seen" — `activityTrackedSince` tells the UI when real data begins.
function computeOverview(producers, now = new Date(), isAdmin = isAdminEmail) {
  const customers = producers.filter((p) => !isAdmin(p.email));
  const nowMs = now.getTime();

  const totals = { customers: customers.length, paid: 0, trialing: 0, expiredUnconverted: 0, comped: 0, pastDue: 0 };
  const byTier = { individual: 0, producer_plus: 0, agency_owner: 0 };
  const expiringSoon = [];
  const pastDue = [];

  for (const p of customers) {
    if (p.subscriptionTier in byTier) byTier[p.subscriptionTier]++;
    const endsAt = trialEndsAt(p);
    if (p.isComped) { totals.comped++; continue; }
    if (p.subscriptionStatus === 'active' || p.subscriptionStatus === 'past_due') {
      totals.paid++;
      if (p.subscriptionStatus === 'past_due') { totals.pastDue++; pastDue.push({ id: p.id, name: p.name, email: p.email }); }
    } else if (nowMs < endsAt.getTime()) {
      totals.trialing++;
      const daysLeft = Math.ceil((endsAt.getTime() - nowMs) / DAY);
      if (daysLeft <= 7) expiringSoon.push({ id: p.id, name: p.name, email: p.email, trialEndsAt: endsAt.toISOString(), daysLeft });
    } else {
      totals.expiredUnconverted++;
    }
  }
  expiringSoon.sort((a, b) => a.daysLeft - b.daysLeft);

  // Of everyone whose trial is over (or who already pays), how many pay now.
  const decided = totals.paid + totals.expiredUnconverted;
  const conversion = { decided, paid: totals.paid, rate: decided ? Math.round((totals.paid / decided) * 1000) / 10 : null };

  // Signups per week, last 8 weeks, oldest first.
  const thisWeek = weekStart(now).getTime();
  const signupsByWeek = [];
  for (let i = 7; i >= 0; i--) {
    const start = thisWeek - i * 7 * DAY;
    signupsByWeek.push({
      weekStart: new Date(start).toISOString().slice(0, 10),
      count: customers.filter((p) => p.createdAt.getTime() >= start && p.createdAt.getTime() < start + 7 * DAY).length,
    });
  }

  const seenTimes = customers.map((p) => p.lastSeenAt).filter(Boolean).map((d) => d.getTime());
  const activity = {
    active7: customers.filter((p) => p.lastSeenAt && nowMs - p.lastSeenAt.getTime() <= 7 * DAY).length,
    active30: customers.filter((p) => p.lastSeenAt && nowMs - p.lastSeenAt.getTime() <= 30 * DAY).length,
    neverSeen: customers.filter((p) => !p.lastSeenAt).length,
  };
  const activityTrackedSince = seenTimes.length ? new Date(Math.min(...seenTimes)).toISOString() : null;

  // Customers who joined over a week ago, still have access (trialing/paid/comped), and
  // haven't been in for 7+ days — the ones worth a nudge.
  const quiet = customers
    .filter((p) => nowMs - p.createdAt.getTime() > 7 * DAY)
    .filter((p) => p.isComped || p.subscriptionStatus === 'active' || p.subscriptionStatus === 'past_due' || nowMs < trialEndsAt(p).getTime())
    .filter((p) => !p.lastSeenAt || nowMs - p.lastSeenAt.getTime() > 7 * DAY)
    .map((p) => ({
      id: p.id, name: p.name, email: p.email,
      lastSeenAt: p.lastSeenAt ? p.lastSeenAt.toISOString() : null,
      daysSilent: p.lastSeenAt ? Math.floor((nowMs - p.lastSeenAt.getTime()) / DAY) : null,
    }))
    .sort((a, b) => (a.lastSeenAt || '').localeCompare(b.lastSeenAt || ''))
    .slice(0, 10);

  return { totals, byTier, conversion, signupsByWeek, activity, activityTrackedSince, expiringSoon, pastDue, quiet };
}

module.exports = { computeOverview, weekStart };
