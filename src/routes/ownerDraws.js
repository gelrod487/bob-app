const express = require('express');
const prisma = require('../lib/db');
const { requireAgencyOwner } = require('../middleware/tier');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// Every route here requires the Agency Owner tier — a draw only makes sense at the agency level.
router.use(requireAgencyOwner);

// GET /api/owner-draws
router.get('/', asyncHandler(async (req, res) => {
  const draws = await prisma.ownerDraw.findMany({
    where: { agencyId: req.agencyId },
    orderBy: { drawDate: 'desc' },
  });
  res.json(draws);
}));

// POST /api/owner-draws
router.post('/', asyncHandler(async (req, res) => {
  const { amount, drawDate, notes } = req.body;
  if (amount === undefined || !drawDate) {
    return res.status(400).json({ error: 'amount and drawDate are required.' });
  }
  const draw = await prisma.ownerDraw.create({
    data: { agencyId: req.agencyId, amount, drawDate: new Date(drawDate), notes: notes || null },
  });
  res.status(201).json(draw);
}));

module.exports = router;
