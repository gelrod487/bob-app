// Expands a recurring Expense TEMPLATE row into one virtual instance per occurrence (one
// per calendar month for 'monthly', one per 7-day cycle for 'weekly'), so a recurring cost
// never has to be re-entered — see the doc comment on Expense.isRecurring in
// schema.prisma for why this is computed at read time instead of materializing a row per
// occurrence. A weekly template contributes its full amount on EVERY occurrence, so a
// calendar month picks up 4 or 5 charges depending on how many of the weekly dates land
// inside it that month — exactly like a real weekly bill would hit a bank statement, not
// an averaged/prorated monthly figure. This needs no special handling anywhere monthly
// totals are already computed (Profit tab, dashboard, Desk) — those just sum whatever
// expense rows fall within a date range, and weekly instances are real dated rows like any
// other.
//
// Each virtual instance's `id` is `${template.id}::${monthKey-or-dateKey}` so the frontend
// (and PUT/DELETE /api/expenses/:id) can tell which specific occurrence was clicked while
// still resolving back to the one real template row underneath.
function lastDayOfMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function expandMonthly(template, anchor, rangeStart, seriesEnd) {
  const anchorDay = anchor.getUTCDate();

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

function expandWeekly(template, anchor, rangeStart, seriesEnd) {
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const anchorUTC = Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate());
  const rangeStartUTC = Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), rangeStart.getUTCDate());
  const seriesEndUTC = Date.UTC(seriesEnd.getUTCFullYear(), seriesEnd.getUTCMonth(), seriesEnd.getUTCDate());

  // Jump forward in whole weeks rather than looping one week at a time from the anchor —
  // a series anchored years ago against a recent range would otherwise mean thousands of
  // wasted iterations before reaching rangeStart.
  let cursor = anchorUTC;
  if (cursor < rangeStartUTC) {
    cursor += Math.floor((rangeStartUTC - cursor) / WEEK_MS) * WEEK_MS;
    while (cursor < rangeStartUTC) cursor += WEEK_MS;
  }

  const instances = [];
  while (cursor <= seriesEndUTC) {
    const d = new Date(cursor);
    const dateKey = d.toISOString().slice(0, 10);
    instances.push({ ...template, id: `${template.id}::${dateKey}`, expenseDate: d });
    cursor += WEEK_MS;
  }
  return instances;
}

function expandRecurringExpense(template, rangeFrom, rangeTo) {
  const anchor = new Date(template.expenseDate);

  // Open-ended ranges (no `to` given, e.g. monthlyStatsReal's plain `/api/expenses` call)
  // project up through today, never into the future.
  const today = new Date();
  const rangeStart = rangeFrom ? new Date(rangeFrom) : anchor;
  const rangeEnd = rangeTo ? new Date(rangeTo) : today;
  const seriesEnd = template.recurringEndDate && new Date(template.recurringEndDate) < rangeEnd
    ? new Date(template.recurringEndDate)
    : rangeEnd;

  return template.recurringFrequency === 'weekly'
    ? expandWeekly(template, anchor, rangeStart, seriesEnd)
    : expandMonthly(template, anchor, rangeStart, seriesEnd);
}

// PUT/DELETE take either a plain id (one-time expense) or a composite
// `${realId}::${occurrenceKey}` (one occurrence of a recurring series, either a `yyyy-mm`
// month key or a `yyyy-mm-dd` date key depending on frequency) — both resolve to the same
// underlying template row.
function parseExpenseId(id) {
  const [realId, occurrenceKey] = id.split('::');
  return { realId, monthKey: occurrenceKey || null };
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
