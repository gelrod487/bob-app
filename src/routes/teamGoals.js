const express = require('express');
const prisma = require('../lib/db');
const { requireAgencyOwner } = require('../middleware/tier');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(requireAgencyOwner);

function firstOfMonth(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

// GET /api/team-goals?month=YYYY-MM-DD — same zeroed-defaults-instead-of-404 pattern as
// GET /api/goals. req.agencyId (set by requireAgencyOwner) is the agency this producer
// OWNS, not their membership agencyId — see the Agency model's doc comment.
router.get('/', asyncHandler(async (req, res) => {
  const month = firstOfMonth(req.query.month);
  const teamGoal = await prisma.teamGoal.findUnique({
    where: { agencyId_month: { agencyId: req.agencyId, month } },
  });
  res.json(teamGoal || {
    agencyId: req.agencyId, month, issuedPaidTarget: 0, newWritersTarget: 0, headcountTarget: 0,
  });
}));

// PUT /api/team-goals — body: { month, issuedPaidTarget, newWritersTarget, headcountTarget }
router.put('/', asyncHandler(async (req, res) => {
  const month = firstOfMonth(req.body.month);
  const { issuedPaidTarget = 0, newWritersTarget = 0, headcountTarget = 0 } = req.body;

  const teamGoal = await prisma.teamGoal.upsert({
    where: { agencyId_month: { agencyId: req.agencyId, month } },
    create: { agencyId: req.agencyId, month, issuedPaidTarget, newWritersTarget, headcountTarget },
    update: { issuedPaidTarget, newWritersTarget, headcountTarget },
  });
  res.json(teamGoal);
}));

module.exports = router;
