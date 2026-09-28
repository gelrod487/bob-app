const express = require('express');
const prisma = require('../lib/db');
const { assertExpenseCategoryAllowed } = require('../middleware/tier');
const asyncHandler = require('../middleware/asyncHandler');
const { expandRecurringExpense, parseExpenseId } = require('../lib/recurring');

const router = express.Router();

const VALID_CATEGORIES = [
  'Lead flow', 'Marketing', 'E&O insurance', 'Licenses', 'CRM/Tools',
  'Office', 'Travel', 'Staff', 'Insurance', 'Other',
];

function ownerFilter(producerId) {
  return { OR: [{ producerId }, { agency: { producers: { some: { id: producerId } } } }] };
}

// GET /api/expenses?from=YYYY-MM-DD&to=YYYY-MM-DD — one-time costs are returned as
// literal rows within the range; recurring costs are TEMPLATES (see schema.prisma's
// Expense.isRecurring doc comment) expanded into one virtual instance per month here,
// which is how a recurring cost shows up in every month's totals without being
// re-entered. See src/lib/recurring.js for the expansion logic.
router.get('/', asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const dateFilter = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const [oneTime, recurringTemplates] = await Promise.all([
    prisma.expense.findMany({
      where: {
        ...ownerFilter(req.producerId),
        isRecurring: false,
        ...(from || to ? { expenseDate: dateFilter } : {}),
      },
    }),
    prisma.expense.findMany({
      where: { ...ownerFilter(req.producerId), isRecurring: true },
    }),
  ]);

  const expanded = recurringTemplates.flatMap((t) => expandRecurringExpense(t, from, to));
  const all = [...oneTime, ...expanded].sort((a, b) => new Date(b.expenseDate) - new Date(a.expenseDate));
  res.json(all);
}));

// POST /api/expenses
router.post('/', asyncHandler(async (req, res) => {
  const { ownerType, category, description, vendor, quantity, unitCost, amount, expenseDate, isRecurring } = req.body;

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
      isRecurring: !!isRecurring,
    },
  });

  res.status(201).json(expense);
}));

// PUT /api/expenses/:id — :id is either a plain id (one-time cost) or a composite
// `${realId}::${yyyy-mm}` (one month of a recurring series); both resolve to the same
// underlying row. `stopRecurringAsOf` is a dedicated action (see doc comment below);
// other fields edit the template itself, which — since only one row backs every month of
// a series — applies to EVERY month, past and future, not just the one clicked.
router.put('/:id', asyncHandler(async (req, res) => {
  const { realId } = parseExpenseId(req.params.id);
  const expense = await prisma.expense.findFirst({
    where: { id: realId, ...ownerFilter(req.producerId) },
  });
  if (!expense) return res.status(404).json({ error: 'Cost not found.' });

  const { category, description, amount, expenseDate, stopRecurringAsOf } = req.body;
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
      // Stops the series as of a given month — set instead of touched by default, so a
      // plain field edit (amount/category/etc.) never accidentally cancels the series.
      recurringEndDate: stopRecurringAsOf !== undefined
        ? (stopRecurringAsOf ? new Date(stopRecurringAsOf) : null)
        : expense.recurringEndDate,
    },
  });
  res.json(updated);
}));

// DELETE /api/expenses/:id — removes the ENTIRE series (past and future instances) for a
// recurring cost, since there's only one row backing all of them. To stop a recurring
// cost going forward while keeping past months accurate, use PUT with stopRecurringAsOf
// instead.
router.delete('/:id', asyncHandler(async (req, res) => {
  const { realId } = parseExpenseId(req.params.id);
  const expense = await prisma.expense.findFirst({
    where: { id: realId, ...ownerFilter(req.producerId) },
  });
  if (!expense) return res.status(404).json({ error: 'Cost not found.' });
  await prisma.expense.delete({ where: { id: expense.id } });
  res.json({ ok: true });
}));

module.exports = router;
