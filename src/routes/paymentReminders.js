const express = require('express');
const prisma = require('../lib/db');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// GET /api/payment-reminders?status=pending — used by the dashboard's
// "N policies have expected payments due this month" widget.
router.get('/', asyncHandler(async (req, res) => {
  const { status } = req.query;
  const reminders = await prisma.paymentReminder.findMany({
    where: {
      policy: { client: { producerId: req.producerId } },
      ...(status ? { status } : {}),
    },
    include: { policy: { include: { client: true } } },
    orderBy: { reminderDate: 'asc' },
  });
  res.json(reminders);
}));

// PATCH /api/payment-reminders/:id — manual dismiss (e.g. the policy lapsed
// before reaching that month, so no payment is actually expected).
router.patch('/:id', asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['pending', 'completed', 'dismissed'].includes(status)) {
    return res.status(400).json({ error: 'status must be pending, completed, or dismissed.' });
  }
  // Prisma's update() takes a unique-key where, which can't express the ownership
  // filter directly — confirm ownership with a scoped lookup first (matching every
  // other route's pattern) so one producer can't touch another's reminder just by
  // guessing/obtaining its id.
  const reminder = await prisma.paymentReminder.findFirst({
    where: { id: req.params.id, policy: { client: { producerId: req.producerId } } },
  });
  if (!reminder) return res.status(404).json({ error: 'Reminder not found.' });

  const updated = await prisma.paymentReminder.update({
    where: { id: reminder.id },
    data: { status },
  });
  res.json(updated);
}));

module.exports = router;
