const supabaseAdmin = require('../lib/supabase');
const prisma = require('../lib/db');
const asyncHandler = require('./asyncHandler');

// The access token's signature is already verified by supabaseAdmin.auth.getUser() below —
// this just reads the `aal` (Authenticator Assurance Level) claim out of the payload that
// call already vouched for, so we don't need a second round-trip to inspect it.
function decodeJwtPayload(token) {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

// Verifies the Supabase access token on every /api request and, if a Producer row already
// exists for that Supabase user, attaches it. Routes that need an existing Producer (i.e.
// everything except POST /api/auth/bootstrap) should also apply requireProducer below.
async function requireAuth(req, res, next) {
  const header = req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing bearer token.' });

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ error: 'Invalid or expired session.' });

  // If this account has TOTP enrolled, a password-only (aal1) session isn't enough — the
  // browser must have completed the MFA challenge (aal2) too. Without this, someone who
  // steals just the password (phishing, credential stuffing, a leaked-password match) could
  // hit the API directly with an aal1 token and skip the second factor the login UI enforces.
  const hasVerifiedFactor = (data.user.factors || []).some((f) => f.status === 'verified');
  if (hasVerifiedFactor) {
    const claims = decodeJwtPayload(token);
    if (!claims || claims.aal !== 'aal2') {
      return res.status(401).json({ error: 'Additional verification required.', mfaRequired: true });
    }
  }

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

// Shared by requireActiveOrTrial and the Producer Plus feature gate (src/middleware/tier.js)
// — a producer still inside their 14-day trial gets full Producer Plus-level feature access
// regardless of which plan they picked at signup, so the trial actually shows off the more
// robust version of BOB rather than whatever tier they happened to click first.
function isTrialing(producer) {
  return new Date() < trialEndsAt(producer);
}

// Shared by requireAdmin, requireActiveOrTrial, and GET /api/me — a short allowlist of
// emails set via the ADMIN_EMAILS env var (comma-separated). Deliberately not a DB flag,
// so granting or revoking admin access is a Render dashboard change, not a code/data change
// (a bug or exploit that can write to the database still can't self-promote to admin).
function isAdminEmail(email) {
  const allowlist = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return !!email && allowlist.includes(email.toLowerCase());
}

// Apply after requireProducer on any route that should stop working once a free trial
// runs out and was never converted to a paid subscription. Deliberately NOT applied to
// /api/me (needs to report trial status even when expired) or /api/billing (has to stay
// reachable so an expired producer can still subscribe).
//
// Note: an agent invited into an agency still needs their own subscription — being under
// an agencyId only determines whose dashboard their numbers roll up into, not billing.
// Each producer (owner or agent) carries their own trial clock and subscriptionStatus.
// Admin-allowlisted accounts are exempt — they're internal team, not paying customers.
function requireActiveOrTrial(req, res, next) {
  if (isAdminEmail(req.supabaseUser?.email)) return next();

  const producer = req.producer;
  if (producer.subscriptionStatus === 'active' || producer.subscriptionStatus === 'past_due' || isTrialing(producer)) {
    return next();
  }
  return res.status(402).json({ error: 'Your 14-day trial has ended. Subscribe to keep using BOB.', trialExpired: true });
}

// Gates the internal admin dashboard to the ADMIN_EMAILS allowlist.
function requireAdmin(req, res, next) {
  if (!isAdminEmail(req.supabaseUser?.email)) {
    return res.status(403).json({ error: 'Not authorized.' });
  }
  next();
}

module.exports = {
  requireAuth: asyncHandler(requireAuth), requireProducer, requireAdmin, requireActiveOrTrial, trialEndsAt, isAdminEmail, isTrialing,
};
