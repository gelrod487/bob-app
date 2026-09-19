const express = require('express');
const prisma = require('../lib/db');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

function firstOfMonth(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

// GET /api/goals?month=YYYY-MM-DD — defaults to the current month. Returns zeroed targets
// if none have been set yet, rather than 404ing (Settings and the Desk both expect a row).
router.get('/', asyncHandler(async (req, res) => {
  const month = firstOfMonth(req.query.month);
  const goal = await prisma.goal.findUnique({
    where: { producerId_month: { producerId: req.producerId, month } },
  });
  res.json(goal || {
    producerId: req.producerId, month,
    dialsTarget: 0, appointmentsTarget: 0, sitsTarget: 0, salesTarget: 0, fycTarget: 0,
  });
}));

// PUT /api/goals — body: { month, dialsTarget, appointmentsTarget, sitsTarget, salesTarget, fycTarget }
router.put('/', asyncHandler(async (req, res) => {
  const month = firstOfMonth(req.body.month);
  const { dialsTarget = 0, appointmentsTarget = 0, sitsTarget = 0, salesTarget = 0, fycTarget = 0 } = req.body;

  const goal = await prisma.goal.upsert({
    where: { producerId_month: { producerId: req.producerId, month } },
    create: { producerId: req.producerId, month, dialsTarget, appointmentsTarget, sitsTarget, salesTarget, fycTarget },
    update: { dialsTarget, appointmentsTarget, sitsTarget, salesTarget, fycTarget },
  });
  res.json(goal);
}));

module.exports = router;
