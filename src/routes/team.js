const express = require('express');
const prisma = require('../lib/db');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// GET /api/team — the agency owner's roster: every producer sharing their agencyId
// (including themselves), so they can see who's on their book and each one's own
// subscription status (joining an agency doesn't cover anyone's billing — see
// requireActiveOrTrial).
router.get('/', asyncHandler(async (req, res) => {
  const owner = await prisma.producer.findUnique({ where: { id: req.producerId } });
  if (owner.subscriptionTier !== 'agency_owner' || !owner.agencyId) {
    return res.status(403).json({ error: 'Only an agency owner has a team roster.' });
  }

  const roster = await prisma.producer.findMany({
    where: { agencyId: owner.agencyId },
    select: {
      id: true, name: true, email: true, subscriptionTier: true, subscriptionStatus: true, createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  res.json({ agencyId: owner.agencyId, roster });
}));

module.exports = router;
