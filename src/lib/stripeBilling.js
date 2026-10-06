// Read-only Stripe lookups for the admin console. Everything takes the Stripe client as a
// parameter so it can be unit-tested with a fake one.

function stripeMode(secretKey = process.env.STRIPE_SECRET_KEY) {
  const key = (secretKey || '').trim();
  // sk_live_ is a standard secret key; rk_live_ is a restricted key (what Stripe issues for "full access except sensitive operations").
  return key.startsWith('sk_live_') || key.startsWith('rk_live_') ? 'live' : 'test';
}

function customerDashboardUrl(customerId, mode = stripeMode()) {
  return `https://dashboard.stripe.com/${mode === 'test' ? 'test/' : ''}customers/${encodeURIComponent(customerId)}`;
}

// Same mapping the webhook uses when Stripe tells BOB a subscription changed
// (billingWebhook.js, customer.subscription.updated/deleted): what BOB's subscriptionStatus
// SHOULD be for a given Stripe subscription.
function expectedStatus(subscription) {
  if (subscription.status === 'canceled') return 'canceled';
  if (subscription.status === 'active') return 'active';
  if (subscription.status === 'past_due') return 'past_due';
  return subscription.cancel_at_period_end ? 'active' : 'inactive';
}

// Which BOB tier a Stripe price id corresponds to, from the same env vars billing.js uses.
function tierForPrice(priceId, env = process.env) {
  if (!priceId) return null;
  const clean = (v) => (v || '').trim();
  if (priceId === clean(env.STRIPE_PRICE_ID_INDIVIDUAL)) return 'individual';
  if (priceId === clean(env.STRIPE_PRICE_ID_PRODUCER_PLUS)) return 'producer_plus';
  if (priceId === clean(env.STRIPE_PRICE_ID_AGENCY)) return 'agency_owner';
  return null;
}

// Moves a producer to a new BOB tier after their Stripe plan changed (in-app switch or the
// Stripe customer portal). Moving INTO Agency also gives them an agency to own, the same way
// choosing Agency at checkout does. A no-op when the tier already matches, so it is safe to
// call from both the switch route and the webhook for the same change.
async function applyTierChange(prisma, producerId, tier) {
  if (!tier) return;
  const producer = await prisma.producer.findUnique({ where: { id: producerId } });
  if (!producer || producer.subscriptionTier === tier) return;
  const data = { subscriptionTier: tier };
  if (tier === 'agency_owner') {
    let owned = await prisma.agency.findUnique({ where: { ownerId: producerId } });
    if (!owned) {
      owned = await prisma.agency.create({
        data: { name: `${producer.name}'s Agency`, ownerId: producerId, parentAgencyId: producer.agencyId || undefined },
      });
    }
    if (!producer.agencyId) data.agencyId = owned.id;
  }
  await prisma.producer.update({ where: { id: producerId }, data });
}

// Live Stripe state for one producer, plus any disagreement with what BOB has stored.
// The webhook now follows plan changes, but it still ignores payment-failure events and could
// miss one, so a producer's stored state can drift from Stripe — this makes that visible.
async function getBillingSummary(producer, stripeClient, mode = stripeMode()) {
  if (!producer.stripeCustomerId) {
    return { linked: false, mode, mismatches: [], note: 'No Stripe customer yet — this producer never started checkout.' };
  }

  const customerId = producer.stripeCustomerId;
  const [customer, subscriptions, invoices] = await Promise.all([
    stripeClient.customers.retrieve(customerId),
    stripeClient.subscriptions.list({ customer: customerId, status: 'all', limit: 5 }),
    stripeClient.invoices.list({ customer: customerId, limit: 5 }),
  ]);

  const base = { linked: true, mode, dashboardUrl: customerDashboardUrl(customerId, mode), mismatches: [] };
  if (customer.deleted) {
    return { ...base, customerDeleted: true, mismatches: ['The Stripe customer record has been deleted.'] };
  }

  const subs = subscriptions.data || [];
  const sub = subs.find((s) => s.id === producer.stripeSubscriptionId)
    || subs.find((s) => s.status !== 'canceled')
    || subs[0]
    || null;

  const item = sub?.items?.data?.[0];
  const priceId = item?.price?.id || null;
  const summary = {
    ...base,
    customer: { email: customer.email || null },
    subscription: sub ? {
      id: sub.id,
      status: sub.status,
      cancelAtPeriodEnd: !!sub.cancel_at_period_end,
      currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
      priceId,
      tierFromPrice: tierForPrice(priceId),
    } : null,
    invoices: (invoices.data || []).map((i) => ({
      id: i.id,
      number: i.number || null,
      status: i.status,
      amountDue: i.amount_due,
      amountPaid: i.amount_paid,
      currency: i.currency,
      created: i.created ? new Date(i.created * 1000).toISOString() : null,
      hostedInvoiceUrl: i.hosted_invoice_url || null,
    })),
  };

  // A comped account is deliberately hand-managed, so differences are expected, not drift.
  if (producer.isComped) {
    summary.comped = true;
    return summary;
  }

  if (!sub) {
    if (producer.subscriptionStatus === 'active' || producer.subscriptionStatus === 'past_due') {
      summary.mismatches.push(`BOB shows "${producer.subscriptionStatus}" but Stripe has no subscription for this customer.`);
    }
    return summary;
  }
  const want = expectedStatus(sub);
  if (want !== producer.subscriptionStatus) {
    summary.mismatches.push(`Stripe says the subscription is "${sub.status}"${sub.cancel_at_period_end ? ' (cancelling at period end)' : ''}, so BOB should show "${want}" — it shows "${producer.subscriptionStatus}".`);
  }
  const tier = summary.subscription.tierFromPrice;
  if (tier && tier !== producer.subscriptionTier) {
    summary.mismatches.push(`Stripe bills the ${tier} price, but BOB has this producer on "${producer.subscriptionTier}".`);
  }
  if (producer.stripeSubscriptionId && producer.stripeSubscriptionId !== sub.id) {
    summary.mismatches.push('BOB is tracking a different subscription id than the one currently active in Stripe.');
  }
  return summary;
}

module.exports = { stripeMode, customerDashboardUrl, expectedStatus, tierForPrice, applyTierChange, getBillingSummary };
