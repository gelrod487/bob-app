const prisma = require('./db');

// These two functions are the direct implementation of the "Profitability formulas"
// section of bob-schema.md. Keep them as the single source of truth for the math —
// the dashboard, any reports, and the mobile app (if one ever exists) should all
// call these rather than re-deriving the formula themselves.

/**
 * Net profit for a single Individual Producer over a date range.
 * = commission ledger (advance + additional + chargeback + other)
 * - expenses in lead_cost / operations / travel
 * (staff & recruiting are agency-only categories and won't appear for an
 * individual producer, but are excluded explicitly for clarity anyway.)
 */
async function producerProfitability(producerId, { from, to } = {}) {
  const dateFilter = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const commissionWhere = {
    ownerType: 'producer',
    producerId,
    entryType: { in: ['advance', 'additional', 'chargeback', 'other'] },
    ...(from || to ? { entryDate: dateFilter } : {}),
  };
  const expenseWhere = {
    ownerType: 'producer',
    producerId,
    category: { in: ['lead_cost', 'operations', 'travel'] },
    ...(from || to ? { expenseDate: dateFilter } : {}),
  };

  const [commissionAgg, expenseAgg, activePolicyCount] = await Promise.all([
    prisma.commissionEntry.aggregate({ where: commissionWhere, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: expenseWhere, _sum: { amount: true } }),
    prisma.policy.count({
      where: { status: 'active', client: { producerId } },
    }),
  ]);

  const totalCommission = Number(commissionAgg._sum.amount || 0);
  const totalExpenses = Number(expenseAgg._sum.amount || 0);

  return {
    totalCommission,
    totalExpenses,
    netProfit: totalCommission - totalExpenses,
    activePolicyCount,
  };
}

/**
 * Net profit for an Agency Owner over a date range — rolls up every producer
 * under the agency, plus the agency's own override income and expenses.
 */
async function agencyProfitability(agencyId, { from, to } = {}) {
  const dateFilter = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const producers = await prisma.producer.findMany({ where: { agencyId }, select: { id: true } });
  const producerIds = producers.map((p) => p.id);

  const producerCommissionWhere = {
    ownerType: 'producer',
    producerId: { in: producerIds },
    entryType: { in: ['advance', 'additional', 'chargeback', 'other'] },
    ...(from || to ? { entryDate: dateFilter } : {}),
  };
  const overrideWhere = {
    ownerType: 'agency',
    agencyId,
    entryType: 'override',
    ...(from || to ? { entryDate: dateFilter } : {}),
  };
  const expenseWhere = {
    OR: [
      { ownerType: 'producer', producerId: { in: producerIds } },
      { ownerType: 'agency', agencyId },
    ],
    category: { in: ['lead_cost', 'operations', 'staff', 'recruiting', 'travel'] },
    ...(from || to ? { expenseDate: dateFilter } : {}),
  };

  const [producerCommissionAgg, overrideAgg, expenseAgg, activePolicyCount] = await Promise.all([
    prisma.commissionEntry.aggregate({ where: producerCommissionWhere, _sum: { amount: true } }),
    prisma.commissionEntry.aggregate({ where: overrideWhere, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: expenseWhere, _sum: { amount: true } }),
    prisma.policy.count({
      where: { status: 'active', client: { producer: { agencyId } } },
    }),
  ]);

  const totalProducerCommission = Number(producerCommissionAgg._sum.amount || 0);
  const totalOverrides = Number(overrideAgg._sum.amount || 0);
  const totalExpenses = Number(expenseAgg._sum.amount || 0);

  return {
    totalProducerCommission,
    totalOverrides,
    totalExpenses,
    netProfit: totalProducerCommission + totalOverrides - totalExpenses,
    activePolicyCount,
    producerCount: producerIds.length,
  };
}

module.exports = { producerProfitability, agencyProfitability };
