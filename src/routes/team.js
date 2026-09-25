const express = require('express');
const prisma = require('../lib/db');
const { requireAgencyOwner } = require('../middleware/tier');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(requireAgencyOwner);

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

  res.json({ agencyId: req.agencyId, roster });
}));

module.exports = router;
