const prisma = require('./db');

// These two functions are the direct implementation of the "Profitability formulas"
// section of bob-schema.md. Keep them as the single source of truth for the math —
// the dashboard, any reports, and the mobile app (if one ever exists) should all
// call these rather than re-deriving the formula themselves.

/**
 * Net profit for a single Individual Producer over a date range.
 * = commission ledger (advance + additional + chargeback + other)
 * - every expense logged against the producer (the category list is just for
 * the cost breakdown view now — there's no per-category tier restriction).
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
  const grossCommissionWhere = { ...commissionWhere, entryType: { in: ['advance', 'additional', 'other'] } };
  const chargebackWhere = { ...commissionWhere, entryType: 'chargeback' };
  const expenseWhere = {
    ownerType: 'producer',
    producerId,
    ...(from || to ? { expenseDate: dateFilter } : {}),
  };

  const [commissionAgg, grossAgg, chargebackAgg, expenseAgg, activePolicyCount, pendingPolicies] = await Promise.all([
    prisma.commissionEntry.aggregate({ where: commissionWhere, _sum: { amount: true } }),
    prisma.commissionEntry.aggregate({ where: grossCommissionWhere, _sum: { amount: true } }),
    prisma.commissionEntry.aggregate({ where: chargebackWhere, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: expenseWhere, _sum: { amount: true } }),
    prisma.policy.count({
      where: { status: 'active', client: { producerId } },
    }),
    prisma.policy.findMany({
      where: { status: 'pending', client: { producerId } },
      select: { monthlyPremium: true },
    }),
  ]);

  const totalCommission = Number(commissionAgg._sum.amount || 0);
  const grossCommission = Number(grossAgg._sum.amount || 0);
  const chargebacks = Math.abs(Number(chargebackAgg._sum.amount || 0));
  const totalExpenses = Number(expenseAgg._sum.amount || 0);
  const pendingPremium = pendingPolicies.reduce((s, p) => s + Number(p.monthlyPremium) * 12, 0);

  return {
    totalCommission,
    grossCommission,
    chargebacks,
    totalExpenses,
    netProfit: grossCommission - chargebacks - totalExpenses,
    activePolicyCount,
    placedCount: activePolicyCount,
    pendingCount: pendingPolicies.length,
    pendingPremium,
  };
}

/**
 * Net profit for an Agency Owner over a date range — rolls up every producer
 * under the agency, plus the agency's own override income and expenses.
 *
 * Also rolls up one level of sub-agencies: a producer who was a member of this agency
 * and later became an Agency Owner themselves keeps their OWN personal numbers counted
 * here (their `agencyId` never changes — see the doc comment on the Agency model), but
 * their own downlines' numbers live under their own agency instead. Including that
 * sub-agency here is what makes a grandparent owner's dashboard reflect their whole
 * downstream org, not just their direct recruits. Capped at one level (no
 * sub-sub-agencies) — see the conversation in the commit this landed in for why.
 */
async function agencyProfitability(agencyId, { from, to } = {}) {
  const dateFilter = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const subAgencies = await prisma.agency.findMany({ where: { parentAgencyId: agencyId }, select: { id: true } });
  const agencyIds = [agencyId, ...subAgencies.map((a) => a.id)];

  const producers = await prisma.producer.findMany({ where: { agencyId: { in: agencyIds } }, select: { id: true } });
  const producerIds = producers.map((p) => p.id);

  const producerCommissionWhere = {
    ownerType: 'producer',
    producerId: { in: producerIds },
    entryType: { in: ['advance', 'additional', 'chargeback', 'other'] },
    ...(from || to ? { entryDate: dateFilter } : {}),
  };
  const grossCommissionWhere = { ...producerCommissionWhere, entryType: { in: ['advance', 'additional', 'other'] } };
  const chargebackWhere = { ...producerCommissionWhere, entryType: 'chargeback' };
  const overrideWhere = {
    ownerType: 'agency',
    agencyId: { in: agencyIds },
    entryType: 'override',
    ...(from || to ? { entryDate: dateFilter } : {}),
  };
  const expenseWhere = {
    OR: [
      { ownerType: 'producer', producerId: { in: producerIds } },
      { ownerType: 'agency', agencyId: { in: agencyIds } },
    ],
    ...(from || to ? { expenseDate: dateFilter } : {}),
  };

  const [producerCommissionAgg, grossAgg, chargebackAgg, overrideAgg, expenseAgg, activePolicyCount, pendingPolicies] = await Promise.all([
    prisma.commissionEntry.aggregate({ where: producerCommissionWhere, _sum: { amount: true } }),
    prisma.commissionEntry.aggregate({ where: grossCommissionWhere, _sum: { amount: true } }),
    prisma.commissionEntry.aggregate({ where: chargebackWhere, _sum: { amount: true } }),
    prisma.commissionEntry.aggregate({ where: overrideWhere, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: expenseWhere, _sum: { amount: true } }),
    prisma.policy.count({
      where: { status: 'active', client: { producer: { agencyId: { in: agencyIds } } } },
    }),
    prisma.policy.findMany({
      where: { status: 'pending', client: { producer: { agencyId: { in: agencyIds } } } },
      select: { monthlyPremium: true },
    }),
  ]);

  const totalProducerCommission = Number(producerCommissionAgg._sum.amount || 0);
  const grossCommission = Number(grossAgg._sum.amount || 0);
  const chargebacks = Math.abs(Number(chargebackAgg._sum.amount || 0));
  const totalOverrides = Number(overrideAgg._sum.amount || 0);
  const totalExpenses = Number(expenseAgg._sum.amount || 0);
  const pendingPremium = pendingPolicies.reduce((s, p) => s + Number(p.monthlyPremium) * 12, 0);

  return {
    totalProducerCommission,
    grossCommission: grossCommission + totalOverrides,
    chargebacks,
    totalOverrides,
    totalExpenses,
    netProfit: grossCommission + totalOverrides - chargebacks - totalExpenses,
    activePolicyCount,
    placedCount: activePolicyCount,
    pendingCount: pendingPolicies.length,
    pendingPremium,
    producerCount: producerIds.length,
  };
}

module.exports = { producerProfitability, agencyProfitability };
