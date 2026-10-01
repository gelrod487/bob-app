const express = require('express');
const prisma = require('../lib/db');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// A draw is tracked against whichever "pot" it actually came out of: an agency owner's
// own draw comes out of the shared agency pot, while every other producer — solo, or a
// member of someone else's agency — draws against their own book. Same two-owner idea as
// commissionEntries.js's ownerType split, just derived here instead of client-supplied,
// since there's only ever one correct answer for a given producer.
async function resolveOwner(producerId) {
  const ownedAgency = await prisma.agency.findUnique({ where: { ownerId: producerId } });
  return ownedAgency ? { agencyId: ownedAgency.id, producerId: null } : { agencyId: null, producerId };
}

// GET /api/owner-draws?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const owner = await resolveOwner(req.producerId);
  const dateFilter = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const draws = await prisma.ownerDraw.findMany({
    where: {
      ...owner,
      ...(from || to ? { drawDate: dateFilter } : {}),
    },
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
  const owner = await resolveOwner(req.producerId);
  const draw = await prisma.ownerDraw.create({
    data: { ...owner, amount, drawDate: new Date(drawDate), notes: notes || null },
  });
  res.status(201).json(draw);
}));

// PUT /api/owner-draws/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const owner = await resolveOwner(req.producerId);
  const existing = await prisma.ownerDraw.findFirst({ where: { id: req.params.id, ...owner } });
  if (!existing) return res.status(404).json({ error: 'Owner draw not found.' });

  const { amount, drawDate, notes } = req.body;
  const updated = await prisma.ownerDraw.update({
    where: { id: existing.id },
    data: {
      amount: amount !== undefined ? amount : existing.amount,
      drawDate: drawDate ? new Date(drawDate) : existing.drawDate,
      notes: notes !== undefined ? (notes || null) : existing.notes,
    },
  });
  res.json(updated);
}));

// DELETE /api/owner-draws/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const owner = await resolveOwner(req.producerId);
  const existing = await prisma.ownerDraw.findFirst({ where: { id: req.params.id, ...owner } });
  if (!existing) return res.status(404).json({ error: 'Owner draw not found.' });
  await prisma.ownerDraw.delete({ where: { id: existing.id } });
  res.json({ ok: true });
}));

module.exports = router;
