const prisma = require('../lib/db');
const asyncHandler = require('./asyncHandler');
const { isAdminEmail } = require('./auth');
const { logAdminAction } = require('../lib/audit');

// "View as user", for support: an admin whose browser sends X-Support-Producer-Id sees the
// app exactly as that producer would. Strictly read-only — any request that isn't a GET is
// refused outright — and only ever honored for ADMIN_EMAILS accounts, whose normal MFA
// check already ran in requireAuth. Every session is written to the audit log.
//
// Safe to swap req.producer/producerId because every data route scopes its queries by
// req.producerId. No GET handler writes anything (checked when this was added) — keep it
// that way, or this guarantee needs a per-route guard on req.supportView.
const AUDIT_EVERY_MS = 30 * 60 * 1000;
const recentlyAudited = new Map(); // `${adminEmail}:${producerId}` -> timestamp

async function applySupportView(req, res, next) {
  const targetId = req.header('x-support-producer-id');
  if (!targetId) return next();

  if (!isAdminEmail(req.supabaseUser?.email)) return res.status(403).json({ error: 'Not authorized.' });
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(403).json({ error: 'Support view is read-only.' });
  }

  const producer = await prisma.producer.findUnique({ where: { id: targetId } });
  if (!producer) return res.status(404).json({ error: 'Producer not found.' });

  // One audit entry per admin+target per half hour, not one per request.
  const key = `${req.supabaseUser.email}:${producer.id}`;
  const last = recentlyAudited.get(key) || 0;
  if (Date.now() - last > AUDIT_EVERY_MS) {
    recentlyAudited.set(key, Date.now());
    await logAdminAction(req, 'support.view', producer.id, { name: producer.name, email: producer.email });
  }

  req.supportView = true;
  req.producer = producer;
  req.producerId = producer.id;
  next();
}

module.exports = { applySupportView: asyncHandler(applySupportView) };
