const express = require('express');
const prisma = require('../lib/db');
const { assertCommissionEntryAllowed } = require('../middleware/tier');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

const VALID_ENTRY_TYPES = ['advance', 'additional', 'chargeback', 'override', 'other'];

// GET /api/commission-entries?policyId=...&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', asyncHandler(async (req, res) => {
  const { policyId, from, to } = req.query;
  const dateFilter = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const entries = await prisma.commissionEntry.findMany({
    where: {
      ...(policyId ? { policyId } : {}),
      ...(from || to ? { entryDate: dateFilter } : {}),
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

// PUT /api/commission-entries/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const entry = await prisma.commissionEntry.findFirst({
    where: { id: req.params.id, OR: [{ producerId: req.producerId }, { agency: { producers: { some: { id: req.producerId } } } }] },
  });
  if (!entry) return res.status(404).json({ error: 'Commission entry not found.' });

  const { entryType, amount, entryDate, notes } = req.body;
  if (entryType !== undefined && !VALID_ENTRY_TYPES.includes(entryType)) {
    return res.status(400).json({ error: `entryType must be one of: ${VALID_ENTRY_TYPES.join(', ')}` });
  }
  const finalType = entryType ?? entry.entryType;
  const rawAmount = amount !== undefined ? Number(amount) : Math.abs(Number(entry.amount));
  const normalizedAmount = finalType === 'chargeback' ? -Math.abs(rawAmount) : rawAmount;

  const updated = await prisma.commissionEntry.update({
    where: { id: entry.id },
    data: {
      entryType: finalType,
      amount: normalizedAmount,
      entryDate: entryDate ? new Date(entryDate) : entry.entryDate,
      notes: notes !== undefined ? (notes || null) : entry.notes,
    },
  });
  res.json(updated);
}));

// DELETE /api/commission-entries/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const entry = await prisma.commissionEntry.findFirst({
    where: { id: req.params.id, OR: [{ producerId: req.producerId }, { agency: { producers: { some: { id: req.producerId } } } }] },
  });
  if (!entry) return res.status(404).json({ error: 'Commission entry not found.' });
  await prisma.commissionEntry.delete({ where: { id: entry.id } });
  res.json({ ok: true });
}));

module.exports = router;
