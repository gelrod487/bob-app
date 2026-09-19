const express = require('express');
const prisma = require('../lib/db');
const { assertCommissionEntryAllowed } = require('../middleware/tier');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

const VALID_ENTRY_TYPES = ['advance', 'additional', 'chargeback', 'override', 'other'];

// GET /api/commission-entries?policyId=...
router.get('/', asyncHandler(async (req, res) => {
  const { policyId } = req.query;
  const entries = await prisma.commissionEntry.findMany({
    where: {
      ...(policyId ? { policyId } : {}),
      OR: [{ producerId: req.producerId }, { agency: { producers: { some: { id: req.producerId } } } }],
    },
    include: { policy: { include: { client: true } } },
    orderBy: { entryDate: 'desc' },
  });
  res.json(entries);
}));

// POST /api/commission-entries
router.post('/', asyncHandler(async (req, res) => {
  const { policyId, ownerType, entryType, amount, entryDate, notes, agencyId } = req.body;

  if (!policyId || !ownerType || !entryType || amount === undefined || !entryDate) {
    return res.status(400).json({
      error: 'policyId, ownerType, entryType, amount, and entryDate are required.',
    });
  }
  if (!VALID_ENTRY_TYPES.includes(entryType)) {
    return res.status(400).json({ error: `entryType must be one of: ${VALID_ENTRY_TYPES.join(', ')}` });
  }

  try {
    assertCommissionEntryAllowed({ entryType, ownerType });
  } catch (err) {
    return res.status(403).json({ error: err.message });
  }

  // Chargebacks are stored as negative amounts (bob-schema.md) — normalize here so
  // the caller doesn't have to remember to negate it themselves.
  const normalizedAmount = entryType === 'chargeback' ? -Math.abs(Number(amount)) : Number(amount);

  const entry = await prisma.commissionEntry.create({
    data: {
      policyId,
      ownerType,
      producerId: ownerType === 'producer' ? req.producerId : null,
      agencyId: ownerType === 'agency' ? agencyId : null,
      entryType,
      amount: normalizedAmount,
      entryDate: new Date(entryDate),
      notes: notes || null,
    },
  });

  // bob-schema.md "Payment reminders — auto-dismiss rule": an 'additional' entry
  // auto-completes the policy's oldest still-pending reminder.
  if (entryType === 'additional') {
    const oldestPending = await prisma.paymentReminder.findFirst({
      where: { policyId, status: 'pending' },
      orderBy: { reminderDate: 'asc' },
    });
    if (oldestPending) {
      await prisma.paymentReminder.update({
        where: { id: oldestPending.id },
        data: { status: 'completed' },
      });
    }
  }

  res.status(201).json(entry);
}));

module.exports = router;
