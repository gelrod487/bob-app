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

// PUT /api/policies/:id — edits from the client detail view: notes, and moving a case
// through its status (e.g. pending -> active once it's approved and paid), along with
// the issue date that transition actually happened on.
router.put('/:id', asyncHandler(async (req, res) => {
  const policy = await prisma.policy.findFirst({
    where: { id: req.params.id, client: { producerId: req.producerId } },
  });
  if (!policy) return res.status(404).json({ error: 'Case not found.' });

  const {
    notes, status, issueDate, approvedDate, dateSubmitted,
    carrier, productType, policyNumber, faceAmount, monthlyPremium, leadType, leadVendor,
  } = req.body;
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const data = { notes: notes ?? policy.notes };
  if (status !== undefined) data.status = status;
  if (issueDate) data.issueDate = new Date(issueDate);
  if (approvedDate) data.approvedDate = new Date(approvedDate);
  if (dateSubmitted) data.dateSubmitted = new Date(dateSubmitted);
  if (carrier !== undefined) data.carrier = carrier;
  if (productType !== undefined) data.productType = productType;
  if (policyNumber !== undefined) data.policyNumber = policyNumber || null;
  if (faceAmount !== undefined) data.faceAmount = faceAmount || null;
  if (monthlyPremium !== undefined) data.monthlyPremium = monthlyPremium;
  if (leadType !== undefined) data.leadType = leadType || null;
  if (leadVendor !== undefined) data.leadVendor = leadVendor || null;

  const updated = await prisma.policy.update({ where: { id: policy.id }, data });

  // Moving into active for the first time should schedule the same payment reminders
  // a brand-new active case gets — but only once, so a policy that already has them
  // (e.g. was active before) doesn't get a duplicate set.
  if (status === 'active' && policy.status !== 'active') {
    const existingReminders = await prisma.paymentReminder.count({ where: { policyId: policy.id } });
    if (existingReminders === 0) {
      const reminders = buildReminderDates(updated.issueDate);
      await prisma.paymentReminder.createMany({
        data: reminders.map((r) => ({ policyId: policy.id, monthsAfterIssue: r.monthsAfterIssue, reminderDate: r.reminderDate })),
      });
    }
  }

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

// DELETE /api/policies/:id — removes a case entirely, along with its commission
// entries and payment reminders (nothing else references a policy).
router.delete('/:id', asyncHandler(async (req, res) => {
  const policy = await prisma.policy.findFirst({
    where: { id: req.params.id, client: { producerId: req.producerId } },
  });
  if (!policy) return res.status(404).json({ error: 'Case not found.' });

  await prisma.$transaction([
    prisma.paymentReminder.deleteMany({ where: { policyId: policy.id } }),
    prisma.commissionEntry.deleteMany({ where: { policyId: policy.id } }),
    prisma.policy.delete({ where: { id: policy.id } }),
  ]);
  res.json({ ok: true });
}));

module.exports = router;
module.exports.buildReminderDates = buildReminderDates;
