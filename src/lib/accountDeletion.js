const { httpError } = require('./httpError');

// Permanently deletes a producer and everything they own. Dependencies are passed in so the
// ordering and the failure handling can be tested without touching Stripe or Supabase.
//
// Order matters, and so does what happens when a step fails:
//   1. Refuse if it would strand other people (an agency owner whose agency still has
//      members or sub-agencies).
//   2. Cancel any Stripe subscription FIRST. If that fails, stop — nothing has been deleted,
//      so the customer isn't left deleted-but-still-being-billed.
//   3. Delete all rows in one transaction (all-or-nothing), writing the audit entry inside
//      the same transaction so the record exists exactly when the deletion does.
//   4. Remove the login last. If that one step fails the data is already gone, so report it
//      as a warning rather than pretending the whole thing failed.
async function deleteProducerAccount({ prisma, stripe, supabaseAdmin, producer, adminEmail }) {
  const agency = await prisma.agency.findUnique({ where: { ownerId: producer.id } });
  if (agency) {
    const [members, subAgencies] = await Promise.all([
      prisma.producer.count({ where: { agencyId: agency.id, id: { not: producer.id } } }),
      prisma.agency.count({ where: { parentAgencyId: agency.id } }),
    ]);
    if (members || subAgencies) {
      throw httpError(409, `Can't delete an agency owner whose agency still has ${members} other producer(s) and ${subAgencies} sub-agenc${subAgencies === 1 ? 'y' : 'ies'}. Move or remove them first.`);
    }
  }

  let stripeCanceled = false;
  if (producer.stripeSubscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(producer.stripeSubscriptionId);
      if (sub.status !== 'canceled') {
        await stripe.subscriptions.cancel(producer.stripeSubscriptionId);
        stripeCanceled = true;
      }
    } catch (err) {
      if (!(err && (err.code === 'resource_missing' || err.statusCode === 404))) {
        throw httpError(502, `Couldn't cancel the Stripe subscription, so nothing was deleted: ${err.message}`);
      }
    }
  }

  const policies = await prisma.policy.findMany({ where: { client: { producerId: producer.id } }, select: { id: true } });
  const policyIds = policies.map((p) => p.id);
  const byProducer = { producerId: producer.id };
  const byAgency = agency ? [{ agencyId: agency.id }] : [];

  const counts = {
    clients: await prisma.client.count({ where: byProducer }),
    policies: policyIds.length,
    commissionEntries: await prisma.commissionEntry.count({ where: { OR: [{ policyId: { in: policyIds } }, byProducer, ...byAgency] } }),
    expenses: await prisma.expense.count({ where: { OR: [byProducer, ...byAgency] } }),
  };

  await prisma.$transaction(async (tx) => {
    await tx.paymentReminder.deleteMany({ where: { policyId: { in: policyIds } } });
    await tx.commissionEntry.deleteMany({ where: { OR: [{ policyId: { in: policyIds } }, byProducer, ...byAgency] } });
    await tx.policy.deleteMany({ where: { id: { in: policyIds } } });
    await tx.client.deleteMany({ where: byProducer });
    await tx.expense.deleteMany({ where: { OR: [byProducer, ...byAgency] } });
    await tx.ownerDraw.deleteMany({ where: { OR: [byProducer, ...byAgency] } });
    await tx.dailyActivity.deleteMany({ where: byProducer });
    await tx.goal.deleteMany({ where: byProducer });
    await tx.suggestion.deleteMany({ where: byProducer });
    if (agency) await tx.teamGoal.deleteMany({ where: { agencyId: agency.id } });
    // Producer.agencyId and Agency.ownerId point at each other: break the link first.
    await tx.producer.update({ where: { id: producer.id }, data: { agencyId: null } });
    if (agency) await tx.agency.delete({ where: { id: agency.id } });
    await tx.producer.delete({ where: { id: producer.id } });
    await tx.auditLog.create({
      data: {
        adminEmail,
        action: 'producer.delete',
        targetProducerId: producer.id,
        detail: { name: producer.name, email: producer.email, tier: producer.subscriptionTier, stripeCanceled, deleted: counts },
      },
    });
  }, { timeout: 60000 });

  let warning = null;
  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(producer.supabaseUserId);
    if (error) warning = `All BOB data was deleted, but removing the login failed: ${error.message}. Remove the user in Supabase Auth by hand.`;
  } catch (err) {
    warning = `All BOB data was deleted, but removing the login failed: ${err.message}. Remove the user in Supabase Auth by hand.`;
  }
  return { ok: true, stripeCanceled, deleted: counts, warning };
}

module.exports = { deleteProducerAccount };
