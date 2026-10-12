const express = require('express');
const prisma = require('../lib/db');
const { requireAgencyOwner } = require('../middleware/tier');
const asyncHandler = require('../middleware/asyncHandler');
const { httpError } = require('../lib/httpError');

const router = express.Router();
router.use(requireAgencyOwner);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const GROSS_TYPES = ['advance', 'installment', 'additional', 'other'];

// ?from=YYYY-MM-DD&to=YYYY-MM-DD, both optional (no range = all time).
function parseRange(query) {
  const { from, to } = query;
  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) throw httpError(400, 'from and to must be YYYY-MM-DD dates.');
  if (from && to && from > to) throw httpError(400, 'from must not be after to.');
  const dateFilter = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);
  return { from: from || null, to: to || null, dateFilter, active: !!(from || to) };
}

// GET /api/team — the agency owner's roster: every producer who is a direct member
// (agencyId = the owner's own agency, set by requireAgencyOwner as req.agencyId), plus
// one level of sub-agencies — a direct producer who grew into an Agency Owner themselves
// keeps their own personal numbers here, but their own downlines live in their own agency
// instead (see the Agency model's doc comment), so those show up tagged with whose
// sub-team they're actually on.
router.get('/', asyncHandler(async (req, res) => {
  const subAgencies = await prisma.agency.findMany({
    where: { parentAgencyId: req.agencyId },
    select: { id: true, name: true, ownerId: true },
  });
  const agencyIds = [req.agencyId, ...subAgencies.map((a) => a.id)];
  const subAgencyById = new Map(subAgencies.map((a) => [a.id, a]));

  const selectFields = {
    id: true, name: true, email: true, agencyId: true,
    subscriptionTier: true, subscriptionStatus: true, createdAt: true,
  };
  const [producers, self] = await Promise.all([
    prisma.producer.findMany({ where: { agencyId: { in: agencyIds } }, select: selectFields, orderBy: { createdAt: 'asc' } }),
    // The owner themselves might not turn up above — a promoted downline's own agencyId
    // is their upline's agency (see the Agency model's doc comment), not the one they own.
    // Still show them in their own roster for identification, even though their personal
    // production is financially counted with their upline instead of here.
    prisma.producer.findUnique({ where: { id: req.producerId }, select: selectFields }),
  ]);
  if (!producers.some((p) => p.id === self.id)) producers.unshift(self);

  const roster = producers.map((p) => {
    const subAgency = p.agencyId === req.agencyId ? null : subAgencyById.get(p.agencyId);
    return { ...p, reportsVia: subAgency ? subAgency.name : null, isYou: p.id === req.producerId };
  });

  // Production for the chosen date range, per producer on the roster: commissions, chargebacks and cases
  // placed. (Producers' costs are not itemized here; they only roll up inside the agency dashboard totals.)
  const range = parseRange(req.query);
  const memberIds = roster.map((p) => p.id);
  const dated = range.active ? { entryDate: range.dateFilter } : {};
  const [grouped, placedPolicies, overrideAgg] = await Promise.all([
    prisma.commissionEntry.groupBy({
      by: ['producerId', 'entryType'],
      where: { ownerType: 'producer', producerId: { in: memberIds }, entryType: { in: [...GROSS_TYPES, 'chargeback'] }, ...dated },
      _sum: { amount: true },
    }),
    prisma.policy.findMany({
      where: { status: { in: ['active', 'lapsed'] }, client: { producerId: { in: memberIds } }, ...(range.active ? { issueDate: range.dateFilter } : {}) },
      select: { client: { select: { producerId: true } } },
    }),
    prisma.commissionEntry.aggregate({
      where: { ownerType: 'agency', agencyId: { in: agencyIds }, entryType: 'override', ...dated },
      _sum: { amount: true },
    }),
  ]);
  const byMember = new Map(memberIds.map((id) => [id, { id, grossCommission: 0, chargebacks: 0, placedCount: 0 }]));
  grouped.forEach((g) => {
    const row = byMember.get(g.producerId); if (!row) return;
    const amount = Number(g._sum.amount || 0);
    if (g.entryType === 'chargeback') row.chargebacks += Math.abs(amount); else row.grossCommission += amount;
  });
  placedPolicies.forEach((pol) => { const row = byMember.get(pol.client.producerId); if (row) row.placedCount += 1; });
  const members = [...byMember.values()];
  const totals = {
    grossCommission: members.reduce((t, m) => t + m.grossCommission, 0),
    chargebacks: members.reduce((t, m) => t + m.chargebacks, 0),
    placedCount: members.reduce((t, m) => t + m.placedCount, 0),
    overrides: Number(overrideAgg._sum.amount || 0),
  };

  res.json({ agencyId: req.agencyId, roster, production: { from: range.from, to: range.to, members, totals } });
}));

module.exports = router;
