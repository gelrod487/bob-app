const express = require('express');
const prisma = require('../lib/db');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

function firstOfMonth(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

async function requireAgencyOwner(req, res) {
  const producer = await prisma.producer.findUnique({ where: { id: req.producerId } });
  if (producer.subscriptionTier !== 'agency_owner' || !producer.agencyId) {
    res.status(403).json({ error: 'Only an agency owner has team goals.' });
    return null;
  }
  return producer;
}

// GET /api/team-goals?month=YYYY-MM-DD — same zeroed-defaults-instead-of-404 pattern as
// GET /api/goals.
router.get('/', asyncHandler(async (req, res) => {
  const owner = await requireAgencyOwner(req, res);
  if (!owner) return;

  const month = firstOfMonth(req.query.month);
  const teamGoal = await prisma.teamGoal.findUnique({
    where: { agencyId_month: { agencyId: owner.agencyId, month } },
  });
  res.json(teamGoal || {
    agencyId: owner.agencyId, month, issuedPaidTarget: 0, newWritersTarget: 0, headcountTarget: 0,
  });
}));

// PUT /api/team-goals — body: { month, issuedPaidTarget, newWritersTarget, headcountTarget }
router.put('/', asyncHandler(async (req, res) => {
  const owner = await requireAgencyOwner(req, res);
  if (!owner) return;

  const month = firstOfMonth(req.body.month);
  const { issuedPaidTarget = 0, newWritersTarget = 0, headcountTarget = 0 } = req.body;

  const teamGoal = await prisma.teamGoal.upsert({
    where: { agencyId_month: { agencyId: owner.agencyId, month } },
    create: { agencyId: owner.agencyId, month, issuedPaidTarget, newWritersTarget, headcountTarget },
    update: { issuedPaidTarget, newWritersTarget, headcountTarget },
  });
  res.json(teamGoal);
}));

module.exports = router;
