const express = require('express');
const prisma = require('../lib/db');
const asyncHandler = require('../middleware/asyncHandler');

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
router.get('/', asyncHandler(async (req, res) => {
  const { clientId } = req.query;
  const policies = await prisma.policy.findMany({
    where: {
      client: { producerId: req.producerId },
      ...(clientId ? { clientId } : {}),
    },
    include: { client: true, commissionEntries: true, paymentReminders: true },
    orderBy: { issueDate: 'desc' },
  });
  res.json(policies);
}));

// POST /api/policies
router.post('/', asyncHandler(async (req, res) => {
  const {
    clientId, policyNumber, carrier, productType, faceAmount,
    monthlyPremium, issueDate, status, leadType, leadVendor,
    dateSubmitted, approvedDate, notes,
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
      dateSubmitted: dateSubmitted ? new Date(dateSubmitted) : new Date(issueDate),
      approvedDate: approvedDate ? new Date(approvedDate) : null,
      notes: notes || null,
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
}));

// PUT /api/policies/:id — used today for editing the notes field from the client detail view.
router.put('/:id', asyncHandler(async (req, res) => {
  const policy = await prisma.policy.findFirst({
    where: { id: req.params.id, client: { producerId: req.producerId } },
  });
  if (!policy) return res.status(404).json({ error: 'Case not found.' });

  const { notes } = req.body;
  const updated = await prisma.policy.update({
    where: { id: policy.id },
    data: { notes: notes ?? policy.notes },
  });
  res.json(updated);
}));

// POST /api/policies/:id/chargeback — charges back the full commission paid on this case
// (sum of every advance/additional/override entry logged against it) and marks it lapsed.
router.post('/:id/chargeback', asyncHandler(async (req, res) => {
  const policy = await prisma.policy.findFirst({
    where: { id: req.params.id, client: { producerId: req.producerId } },
    include: { commissionEntries: true },
  });
  if (!policy) return res.status(404).json({ error: 'Case not found.' });
  if (policy.status !== 'active') {
    return res.status(400).json({ error: 'Only an issued (active) case can be charged back.' });
  }

  const grossPaid = policy.commissionEntries
    .filter((e) => ['advance', 'additional', 'override'].includes(e.entryType))
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const [entry, updatedPolicy] = await prisma.$transaction([
    prisma.commissionEntry.create({
      data: {
        policyId: policy.id,
        ownerType: 'producer',
        producerId: req.producerId,
        entryType: 'chargeback',
        amount: -Math.abs(grossPaid),
        entryDate: new Date(),
        notes: 'Full chargeback triggered from the case file.',
      },
    }),
    prisma.policy.update({ where: { id: policy.id }, data: { status: 'lapsed' } }),
  ]);

  res.json({ policy: updatedPolicy, chargebackEntry: entry });
}));

module.exports = router;
module.exports.buildReminderDates = buildReminderDates;
