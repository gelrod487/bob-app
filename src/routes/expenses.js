const express = require('express');
const prisma = require('../lib/db');
const { assertExpenseCategoryAllowed } = require('../middleware/tier');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

const VALID_CATEGORIES = [
  'Lead flow', 'Marketing', 'E&O insurance', 'Licenses', 'CRM/Tools',
  'Office', 'Travel', 'Staff', 'Insurance', 'Other',
];

// GET /api/expenses?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const dateFilter = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const expenses = await prisma.expense.findMany({
    where: {
      OR: [{ producerId: req.producerId }, { agency: { producers: { some: { id: req.producerId } } } }],
      ...(from || to ? { expenseDate: dateFilter } : {}),
    },
    orderBy: { expenseDate: 'desc' },
  });
  res.json(expenses);
}));

// POST /api/expenses
router.post('/', asyncHandler(async (req, res) => {
  const { ownerType, category, description, vendor, quantity, unitCost, amount, expenseDate } = req.body;

  if (!ownerType || !category || amount === undefined || !expenseDate) {
    return res.status(400).json({ error: 'ownerType, category, amount, and expenseDate are required.' });
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
  }

  try {
    assertExpenseCategoryAllowed({ category, ownerType });
  } catch (err) {
    return res.status(403).json({ error: err.message });
  }

  // Derived from the authenticated producer's OWN owned agency — see the same note in
  // commissionEntries.js POST for why this can't trust a client-supplied agencyId or
  // read req.producer.agencyId (that's membership, not ownership).
  let agencyId = null;
  if (ownerType === 'agency') {
    const ownedAgency = await prisma.agency.findUnique({ where: { ownerId: req.producerId } });
    if (!ownedAgency) return res.status(403).json({ error: 'Only an agency owner can log an agency-level cost.' });
    agencyId = ownedAgency.id;
  }

  const expense = await prisma.expense.create({
    data: {
      ownerType,
      producerId: ownerType === 'producer' ? req.producerId : null,
      agencyId,
      category,
      description: description || null,
      vendor: vendor || null,
      quantity: quantity ?? null,
      unitCost: unitCost ?? null,
      amount,
      expenseDate: new Date(expenseDate),
    },
  });

  res.status(201).json(expense);
}));

// PUT /api/expenses/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const expense = await prisma.expense.findFirst({
    where: { id: req.params.id, OR: [{ producerId: req.producerId }, { agency: { producers: { some: { id: req.producerId } } } }] },
  });
  if (!expense) return res.status(404).json({ error: 'Cost not found.' });

  const { category, description, amount, expenseDate } = req.body;
  if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
  }

  const updated = await prisma.expense.update({
    where: { id: expense.id },
    data: {
      category: category ?? expense.category,
      description: description !== undefined ? (description || null) : expense.description,
      amount: amount ?? expense.amount,
      expenseDate: expenseDate ? new Date(expenseDate) : expense.expenseDate,
    },
  });
  res.json(updated);
}));

// DELETE /api/expenses/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const expense = await prisma.expense.findFirst({
    where: { id: req.params.id, OR: [{ producerId: req.producerId }, { agency: { producers: { some: { id: req.producerId } } } }] },
  });
  if (!expense) return res.status(404).json({ error: 'Cost not found.' });
  await prisma.expense.delete({ where: { id: expense.id } });
  res.json({ ok: true });
}));

module.exports = router;
