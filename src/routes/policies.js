const express = require('express');
const prisma = require('../lib/db');

const router = express.Router();

const VALID_STATUSES = ['active', 'pending', 'lapsed', 'declined', 'withdrawn'];

// bob-schema.md: reminders only ever get generated for an active policy, at
// months 10/11/12/13 after issue. Kept as its own function so the import
// route (src/routes/import.js) can call the exact same logic.
function buildReminderDates(issueDate) {
  return [10, 11, 12, 13].map((months) => {
    const d = new Date(issueDate);
    d.setMonth(d.getMonth() + months);
    return { monthsAfterIssue: months, reminderDate: d };
  });
}

// GET /api/policies?clientId=...
router.get('/', async (req, res) => {
  const { clientId } = req.query;
  const policies = await prisma.policy.findMany({
    where: {
      client: { producerId: req.producerId },
      ...(clientId ? { clientId } : {}),
    },
    include: { commissionEntries: true, paymentReminders: true },
    orderBy: { issueDate: 'desc' },
  });
  res.json(policies);
});

// POST /api/policies
router.post('/', async (req, res) => {
  const {
    clientId, policyNumber, carrier, productType, faceAmount,
    monthlyPremium, issueDate, status, leadType, leadVendor,
  } = req.body;

  if (!clientId || !carrier || !productType || !monthlyPremium || !issueDate || !status) {
    return res.status(400).json({
      error: 'clientId, carrier, productType, monthlyPremium, issueDate, and status are required.',
    });
  }
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const policy = await prisma.policy.create({
    data: {
      clientId, policyNumber, carrier, productType,
      faceAmount: faceAmount ?? null,
      monthlyPremium,
      issueDate: new Date(issueDate),
      status, leadType, leadVendor,
    },
  });

  // Only active policies get payment reminders (declined/pending/withdrawn don't need them).
  if (status === 'active') {
    const reminders = buildReminderDates(policy.issueDate);
    await prisma.paymentReminder.createMany({
      data: reminders.map((r) => ({
        policyId: policy.id,
        monthsAfterIssue: r.monthsAfterIssue,
        reminderDate: r.reminderDate,
      })),
    });
  }

  res.status(201).json(policy);
});

module.exports = router;
module.exports.buildReminderDates = buildReminderDates;
