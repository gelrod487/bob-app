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

// PUT /api/activity — body: { date, dials, appointments, presentations, sales }
// Sets exact counts for a day (as opposed to /increment's delta bump). Powers the
// "Log a day" form, which lets someone key in a past day's totals directly.
router.put('/', asyncHandler(async (req, res) => {
  const { date } = req.body;
  if (!date) return res.status(400).json({ error: 'date is required.' });

  const data = {};
  for (const f of FIELDS) {
    if (req.body[f] !== undefined) data[f] = Math.max(0, Number(req.body[f]) || 0);
  }

  const row = await prisma.dailyActivity.upsert({
    where: { producerId_date: { producerId: req.producerId, date: new Date(date) } },
    create: { producerId: req.producerId, date: new Date(date), ...data },
    update: data,
  });
  res.json(row);
}));

// DELETE /api/activity/:date — removes a day's row entirely (e.g. a day logged by mistake).
router.delete('/:date', asyncHandler(async (req, res) => {
  const row = await prisma.dailyActivity.findUnique({
    where: { producerId_date: { producerId: req.producerId, date: new Date(req.params.date) } },
  });
  if (!row) return res.status(404).json({ error: 'No activity logged for that date.' });
  await prisma.dailyActivity.delete({ where: { id: row.id } });
  res.json({ ok: true });
}));

module.exports = router;
