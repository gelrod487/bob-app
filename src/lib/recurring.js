// Expands a recurring Expense TEMPLATE row into one virtual instance per calendar month,
// so a recurring cost never has to be re-entered — see the doc comment on
// Expense.isRecurring in schema.prisma for why this is computed at read time instead of
// materializing a row per month.
//
// Each virtual instance's `id` is `${template.id}::${yyyy-mm}` so the frontend (and
// PUT/DELETE /api/expenses/:id) can tell which specific month was clicked while still
// resolving back to the one real template row underneath.
function lastDayOfMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function expandRecurringExpense(template, rangeFrom, rangeTo) {
  const anchor = new Date(template.expenseDate);
  const anchorDay = anchor.getUTCDate();

  // Open-ended ranges (no `to` given, e.g. monthlyStatsReal's plain `/api/expenses` call)
  // project up through the current month, never into the future.
  const today = new Date();
  const rangeStart = rangeFrom ? new Date(rangeFrom) : anchor;
  const rangeEnd = rangeTo ? new Date(rangeTo) : today;
  const seriesEnd = template.recurringEndDate && new Date(template.recurringEndDate) < rangeEnd
    ? new Date(template.recurringEndDate)
    : rangeEnd;

  let cursor = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const windowStart = new Date(Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), 1));
  if (cursor < windowStart) cursor = windowStart;
  const windowEnd = new Date(Date.UTC(seriesEnd.getUTCFullYear(), seriesEnd.getUTCMonth(), 1));

  const instances = [];
  while (cursor <= windowEnd) {
    const year = cursor.getUTCFullYear();
    const monthIndex = cursor.getUTCMonth();
    const day = Math.min(anchorDay, lastDayOfMonth(year, monthIndex));
    const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    instances.push({
      ...template,
      id: `${template.id}::${monthKey}`,
      expenseDate: new Date(Date.UTC(year, monthIndex, day)),
    });
    cursor = new Date(Date.UTC(year, monthIndex + 1, 1));
  }
  return instances;
}

// PUT/DELETE take either a plain id (one-time expense) or a composite
// `${realId}::${yyyy-mm}` (a specific month of a recurring series) — both resolve to the
// same underlying template row.
function parseExpenseId(id) {
  const [realId, monthKey] = id.split('::');
  return { realId, monthKey: monthKey || null };
}

// Sums every expense matching `whereBase` (an owner/category filter with NO date
// condition) within [from, to] — one-time rows counted directly, recurring templates
// expanded first. This is the single place the profitability math (dashboard, Desk,
// Profit) gets its cost total from, so a recurring cost is reflected in every month it
// applies to, not just the month it was first entered.
async function sumExpensesInRange(prisma, whereBase, from, to) {
  const dateFilter = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const [oneTimeAgg, recurringTemplates] = await Promise.all([
    prisma.expense.aggregate({
      where: { ...whereBase, isRecurring: false, ...(from || to ? { expenseDate: dateFilter } : {}) },
      _sum: { amount: true },
    }),
    prisma.expense.findMany({ where: { ...whereBase, isRecurring: true } }),
  ]);

  const recurringTotal = recurringTemplates
    .flatMap((t) => expandRecurringExpense(t, from, to))
    .reduce((sum, inst) => sum + Number(inst.amount), 0);

  return Number(oneTimeAgg._sum.amount || 0) + recurringTotal;
}

module.exports = { expandRecurringExpense, parseExpenseId, sumExpensesInRange };
