// Everything BOB stores for one producer, as plain JSON — for handing a customer their data
// (and for taking a copy before deleting an account). Only this producer's rows: nothing from
// other producers or other members of their agency.
async function buildExport(prisma, producer) {
  const [clients, policies, commissionEntries, expenses, dailyActivities, goals, ownerDraws, suggestions] = await Promise.all([
    prisma.client.findMany({ where: { producerId: producer.id } }),
    prisma.policy.findMany({ where: { client: { producerId: producer.id } }, include: { paymentReminders: true } }),
    prisma.commissionEntry.findMany({ where: { OR: [{ producerId: producer.id }, { policy: { client: { producerId: producer.id } } }] } }),
    prisma.expense.findMany({ where: { producerId: producer.id } }),
    prisma.dailyActivity.findMany({ where: { producerId: producer.id } }),
    prisma.goal.findMany({ where: { producerId: producer.id } }),
    prisma.ownerDraw.findMany({ where: { producerId: producer.id } }),
    prisma.suggestion.findMany({ where: { producerId: producer.id } }),
  ]);

  const out = {
    exportedAt: new Date().toISOString(),
    producer: {
      id: producer.id, name: producer.name, email: producer.email, imo: producer.imo,
      contractLevel: producer.contractLevel, annuityTier: producer.annuityTier,
      subscriptionTier: producer.subscriptionTier, subscriptionStatus: producer.subscriptionStatus,
      createdAt: producer.createdAt,
    },
    clients, policies, commissionEntries, expenses, dailyActivities, goals, ownerDraws, suggestions,
  };

  // An agency owner's own agency-level records (overrides, agency costs and draws, team goals).
  const agency = await prisma.agency.findUnique({ where: { ownerId: producer.id } });
  if (agency) {
    const [agencyCommissionEntries, agencyExpenses, agencyOwnerDraws, teamGoals] = await Promise.all([
      prisma.commissionEntry.findMany({ where: { agencyId: agency.id } }),
      prisma.expense.findMany({ where: { agencyId: agency.id } }),
      prisma.ownerDraw.findMany({ where: { agencyId: agency.id } }),
      prisma.teamGoal.findMany({ where: { agencyId: agency.id } }),
    ]);
    Object.assign(out, { agency, agencyCommissionEntries, agencyExpenses, agencyOwnerDraws, teamGoals });
  }
  return out;
}

module.exports = { buildExport };
