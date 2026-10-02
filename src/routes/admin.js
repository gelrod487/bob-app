const express = require('express');
const prisma = require('../lib/db');
const supabaseAdmin = require('../lib/supabase');
const asyncHandler = require('../middleware/asyncHandler');
const { trialEndsAt } = require('../middleware/auth');
const { logAdminAction } = require('../lib/audit');
const { httpError } = require('../lib/httpError');

// Everything under /api/admin is gated by requireAdmin in server.js — this is BOB's own
// team operating on its customers, not a customer-facing feature. Every write below also
// records an AuditLog row.
const router = express.Router();

router.use('/imos', require('./adminImos'));

const VALID_TIERS = ['individual', 'producer_plus', 'agency_owner'];
const MAX_PAGE_SIZE = 100;

function summarize(p) {
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    imo: p.imo,
    agencyName: p.agency?.name || null,
    subscriptionTier: p.subscriptionTier,
    subscriptionStatus: p.subscriptionStatus,
    isComped: p.isComped,
    clientCount: p._count?.clients ?? 0,
    createdAt: p.createdAt,
    lastSeenAt: p.lastSeenAt,
    trialEndsAt: trialEndsAt(p),
  };
}

// GET /api/admin/producers?q=&page=&pageSize= — customers, searchable by name/email/IMO.
router.get('/producers', asyncHandler(async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 25, 1), MAX_PAGE_SIZE);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const where = q ? {
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { imo: { contains: q, mode: 'insensitive' } },
    ],
  } : {};

  const [total, producers] = await Promise.all([
    prisma.producer.count({ where }),
    prisma.producer.findMany({
      where,
      include: { agency: true, _count: { select: { clients: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  res.json({ items: producers.map(summarize), total, page, pageSize });
}));

// GET /api/admin/producers/:id — one customer in full: account fields, record counts, and
// the Supabase last-sign-in time (the only place that exists; BOB doesn't track logins).
router.get('/producers/:id', asyncHandler(async (req, res) => {
  const p = await prisma.producer.findUnique({
    where: { id: req.params.id },
    include: { agency: true, _count: { select: { clients: true, commissionEntries: true, dailyActivities: true, ownerDraws: true, expenses: true } } },
  });
  if (!p) return res.status(404).json({ error: 'Producer not found.' });

  const policyCount = await prisma.policy.count({ where: { client: { producerId: p.id } } });
  let lastSignInAt = null;
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(p.supabaseUserId);
    lastSignInAt = data?.user?.last_sign_in_at || null;
  } catch { /* detail view still works without it */ }

  res.json({
    ...summarize(p),
    stripeCustomerId: p.stripeCustomerId,
    stripeSubscriptionId: p.stripeSubscriptionId,
    trialEndsAtOverride: p.trialEndsAtOverride,
    adminNotes: p.adminNotes,
    contractLevel: p.contractLevel,
    annuityTier: p.annuityTier,
    lastSignInAt,
    counts: {
      clients: p._count.clients,
      policies: policyCount,
      commissionEntries: p._count.commissionEntries,
      expenses: p._count.expenses,
      activityDays: p._count.dailyActivities,
      ownerDraws: p._count.ownerDraws,
    },
  });
}));

// PUT /api/admin/producers/:id — account management. Accepts any subset of:
//   subscriptionTier, isComped, trialEndsAt (ISO date, or null to clear the override),
//   extendTrialDays (adds to whichever is later: the current trial end or now), adminNotes.
// isComped matters because the Stripe webhook skips comped accounts — a hand-set tier and
// status would otherwise be overwritten by the next Stripe event.
router.put('/producers/:id', asyncHandler(async (req, res) => {
  const p = await prisma.producer.findUnique({ where: { id: req.params.id } });
  if (!p) return res.status(404).json({ error: 'Producer not found.' });

  const { subscriptionTier, isComped, trialEndsAt: trialEndsAtInput, extendTrialDays, adminNotes } = req.body;
  const data = {};

  if (subscriptionTier !== undefined) {
    if (!VALID_TIERS.includes(subscriptionTier)) throw httpError(400, `subscriptionTier must be one of: ${VALID_TIERS.join(', ')}`);
    data.subscriptionTier = subscriptionTier;
  }
  if (isComped !== undefined) {
    if (typeof isComped !== 'boolean') throw httpError(400, 'isComped must be true or false.');
    data.isComped = isComped;
    // Comping makes the account paid; un-comping an account that has no Stripe
    // subscription behind it must not leave it stuck "active" forever.
    if (isComped) data.subscriptionStatus = 'active';
    else if (!p.stripeSubscriptionId) data.subscriptionStatus = 'inactive';
  }
  if (trialEndsAtInput !== undefined) {
    if (trialEndsAtInput === null) data.trialEndsAtOverride = null;
    else {
      const d = new Date(trialEndsAtInput);
      if (Number.isNaN(d.getTime())) throw httpError(400, 'trialEndsAt must be a valid date.');
      data.trialEndsAtOverride = d;
    }
  }
  if (extendTrialDays !== undefined) {
    const days = Number(extendTrialDays);
    if (!Number.isFinite(days) || days <= 0 || days > 365) throw httpError(400, 'extendTrialDays must be between 1 and 365.');
    const base = Math.max(trialEndsAt(p).getTime(), Date.now());
    data.trialEndsAtOverride = new Date(base + days * 24 * 60 * 60 * 1000);
  }
  if (adminNotes !== undefined) {
    data.adminNotes = adminNotes ? String(adminNotes).slice(0, 2000) : null;
  }
  if (!Object.keys(data).length) throw httpError(400, 'Nothing to update.');

  const updated = await prisma.$transaction(async (tx) => {
    // The app assumes an agency_owner always has an owned Agency row (bootstrap and the
    // Stripe webhook both create one) — so switching someone to that tier by hand must too.
    if (data.subscriptionTier === 'agency_owner') {
      const owned = await tx.agency.findUnique({ where: { ownerId: p.id } });
      if (!owned) {
        const agency = await tx.agency.create({
          data: { name: `${p.name}'s Agency`, ownerId: p.id, parentAgencyId: p.agencyId || undefined },
        });
        if (!p.agencyId) data.agencyId = agency.id;
      }
    }
    return tx.producer.update({ where: { id: p.id }, data, include: { agency: true, _count: { select: { clients: true } } } });
  });

  const before = {}; const after = {};
  for (const key of Object.keys(data)) { before[key] = p[key]; after[key] = updated[key]; }
  await logAdminAction(req, 'producer.update', p.id, { before, after });
  res.json(summarize(updated));
}));

// GET /api/admin/audit?action=&target=&page= — newest first.
router.get('/audit', asyncHandler(async (req, res) => {
  const pageSize = 50;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const where = {
    ...(req.query.action ? { action: { startsWith: req.query.action.toString() } } : {}),
    ...(req.query.target ? { targetProducerId: req.query.target.toString() } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  res.json({ items, total, page, pageSize });
}));

const VALID_STATUSES = ['open', 'planned', 'done', 'declined'];

// GET /api/admin/suggestions — every producer's feedback, newest first.
router.get('/suggestions', asyncHandler(async (req, res) => {
  const suggestions = await prisma.suggestion.findMany({
    include: { producer: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(suggestions.map((s) => ({
    id: s.id,
    message: s.message,
    status: s.status,
    createdAt: s.createdAt,
    producerName: s.producer.name,
    producerEmail: s.producer.email,
  })));
}));

// PUT /api/admin/suggestions/:id — status triage only (open/planned/done/declined).
router.put('/suggestions/:id', asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  const existing = await prisma.suggestion.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Suggestion not found.' });
  const updated = await prisma.suggestion.update({ where: { id: existing.id }, data: { status } });
  await logAdminAction(req, 'suggestion.status', existing.producerId, { id: existing.id, from: existing.status, to: status });
  res.json(updated);
}));

module.exports = router;
