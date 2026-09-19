const express = require('express');
const prisma = require('../lib/db');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

const FIELDS = ['dials', 'appointments', 'presentations', 'sales'];

// GET /api/activity?from=YYYY-MM-DD&to=YYYY-MM-DD — raw daily rows for the funnel,
// "This month vs. goals," and the trend chart. No rows for a day just means zero activity.
router.get('/', asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const dateFilter = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const rows = await prisma.dailyActivity.findMany({
    where: { producerId: req.producerId, ...(from || to ? { date: dateFilter } : {}) },
    orderBy: { date: 'asc' },
  });
  res.json(rows);
}));

// POST /api/activity/increment — body: { date: 'YYYY-MM-DD', field: 'dials', delta: 1 }
// Upserts today's row and bumps one counter. Powers the +/- steppers on the Desk.
router.post('/increment', asyncHandler(async (req, res) => {
  const { date, field, delta } = req.body;
  if (!date || !FIELDS.includes(field) || typeof delta !== 'number') {
    return res.status(400).json({ error: `date, delta, and field (one of ${FIELDS.join(', ')}) are required.` });
  }

  const existing = await prisma.dailyActivity.findUnique({
    where: { producerId_date: { producerId: req.producerId, date: new Date(date) } },
  });
  const nextValue = Math.max(0, (existing ? existing[field] : 0) + delta);

  const row = await prisma.dailyActivity.upsert({
    where: { producerId_date: { producerId: req.producerId, date: new Date(date) } },
    create: { producerId: req.producerId, date: new Date(date), [field]: nextValue },
    update: { [field]: nextValue },
  });
  res.json(row);
}));

module.exports = router;
