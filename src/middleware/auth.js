const supabaseAdmin = require('../lib/supabase');
const prisma = require('../lib/db');
const asyncHandler = require('./asyncHandler');

// Verifies the Supabase access token on every /api request and, if a Producer row already
// exists for that Supabase user, attaches it. Routes that need an existing Producer (i.e.
// everything except POST /api/auth/bootstrap) should also apply requireProducer below.
async function requireAuth(req, res, next) {
  const header = req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing bearer token.' });

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ error: 'Invalid or expired session.' });

  req.supabaseUser = data.user;
  const producer = await prisma.producer.findUnique({ where: { supabaseUserId: data.user.id } });
  req.producer = producer;
  req.producerId = producer ? producer.id : null;
  next();
}

// Apply after requireAuth on any route that needs req.producerId to already be set —
// without this, a Prisma `where: { producerId: undefined }` would silently match every
// producer's rows instead of failing closed.
function requireProducer(req, res, next) {
  if (!req.producerId) {
    return res.status(409).json({ error: 'Finish setting up your account first (POST /api/auth/bootstrap).' });
  }
  next();
}

const TRIAL_DAYS = 14;

function trialEndsAt(producer) {
  return new Date(producer.createdAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

// Apply after requireProducer on any route that should stop working once a free trial
// runs out and was never converted to a paid subscription. Deliberately NOT applied to
// /api/me (needs to report trial status even when expired) or /api/billing (has to stay
// reachable so an expired producer can still subscribe).
//
// Note: an agent invited into an agency still needs their own subscription — being under
// an agencyId only determines whose dashboard their numbers roll up into, not billing.
// Each producer (owner or agent) carries their own trial clock and subscriptionStatus.
function requireActiveOrTrial(req, res, next) {
  const producer = req.producer;
  const stillTrialing = new Date() < trialEndsAt(producer);
  if (producer.subscriptionStatus === 'active' || producer.subscriptionStatus === 'past_due' || stillTrialing) {
    return next();
  }
  return res.status(402).json({ error: 'Your 14-day trial has ended. Subscribe to keep using BOB.', trialExpired: true });
}

// Gates the internal admin dashboard to a short allowlist of emails set via the
// ADMIN_EMAILS env var (comma-separated) — deliberately not a DB flag, so granting or
// revoking admin access is a Render dashboard change, not a code/data change.
function requireAdmin(req, res, next) {
  const allowlist = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  const email = (req.supabaseUser?.email || '').toLowerCase();
  if (!email || !allowlist.includes(email)) {
    return res.status(403).json({ error: 'Not authorized.' });
  }
  next();
}

module.exports = {
  requireAuth: asyncHandler(requireAuth), requireProducer, requireAdmin, requireActiveOrTrial, trialEndsAt,
};
