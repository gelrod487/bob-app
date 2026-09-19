const express = require('express');
const prisma = require('../lib/db');
const { assertExpenseCategoryAllowed } = require('../middleware/tier');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

const VALID_CATEGORIES = ['lead_cost', 'operations', 'staff', 'recruiting', 'travel'];

// GET /api/expenses
router.get('/', asyncHandler(async (req, res) => {
  const expenses = await prisma.expense.findMany({
    where: { OR: [{ producerId: req.producerId }, { agency: { producers: { some: { id: req.producerId } } } }] },
    orderBy: { expenseDate: 'desc' },
  });
  res.json(expenses);
}));

// POST /api/expenses
router.post('/', asyncHandler(async (req, res) => {
  const { ownerType, category, description, vendor, quantity, unitCost, amount, expenseDate, agencyId } = req.body;

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

  const expense = await prisma.expense.create({
    data: {
      ownerType,
      producerId: ownerType === 'producer' ? req.producerId : null,
      agencyId: ownerType === 'agency' ? agencyId : null,
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

module.exports = router;
