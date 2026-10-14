const express = require('express');
const prisma = require('../lib/db');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

const WINDOW_DAYS = 30; // the "Get started" card only shows during an account's first month

// GET /api/onboarding — which first-run steps this producer has done, worked out from their real data
// (nothing is stored). `show` is false once they've done them all or the account is more than a month old,
// so established accounts never get nagged.
router.get('/', asyncHandler(async (req, res) => {
  const producerId = req.producerId;
  const [clients, expenses, activity, goals, producer] = await Promise.all([
    prisma.client.count({ where: { producerId } }),
    prisma.expense.count({ where: { ownerType: 'producer', producerId } }),
    prisma.dailyActivity.count({ where: { producerId, OR: [{ dials: { gt: 0 } }, { contacts: { gt: 0 } }, { appointments: { gt: 0 } }, { presentations: { gt: 0 } }, { sales: { gt: 0 } }] } }),
    prisma.goal.count({ where: { producerId, OR: [{ dialsTarget: { gt: 0 } }, { appointmentsTarget: { gt: 0 } }, { sitsTarget: { gt: 0 } }, { fycTarget: { gt: 0 } }] } }),
    prisma.producer.findUnique({ where: { id: producerId }, select: { createdAt: true } }),
  ]);
  const steps = [
    { key: 'client', done: clients > 0 },
    { key: 'cost', done: expenses > 0 },
    { key: 'activity', done: activity > 0 },
    { key: 'goal', done: goals > 0 },
  ];
  const done = steps.filter((s) => s.done).length;
  const young = Date.now() - producer.createdAt.getTime() <= WINDOW_DAYS * 24 * 60 * 60 * 1000;
  res.json({ steps, done, total: steps.length, show: young && done < steps.length });
}));

module.exports = router;
