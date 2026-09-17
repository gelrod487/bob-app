const express = require('express');
const prisma = require('../lib/db');

const router = express.Router();

// GET /api/payment-reminders?status=pending — used by the dashboard's
// "N policies have expected payments due this month" widget.
router.get('/', async (req, res) => {
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
});

// PATCH /api/payment-reminders/:id — manual dismiss (e.g. the policy lapsed
// before reaching that month, so no payment is actually expected).
router.patch('/:id', async (req, res) => {
  const { status } = req.body;
  if (!['pending', 'completed', 'dismissed'].includes(status)) {
    return res.status(400).json({ error: 'status must be pending, completed, or dismissed.' });
  }
  const reminder = await prisma.paymentReminder.update({
    where: { id: req.params.id },
    data: { status },
  });
  res.json(reminder);
});

module.exports = router;
