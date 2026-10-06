const express = require('express');
const stripe = require('../lib/stripe');
const prisma = require('../lib/db');
const asyncHandler = require('../middleware/asyncHandler');
const { applyTierChange } = require('../lib/stripeBilling');

const router = express.Router();

// True only when the env var is exactly "true" (any other value, or unset, keeps tax off).
function taxEnabled() {
  return (process.env.STRIPE_AUTOMATIC_TAX || '').trim().toLowerCase() === 'true';
}

const PRICE_BY_TIER = {
  individual: process.env.STRIPE_PRICE_ID_INDIVIDUAL,
  producer_plus: process.env.STRIPE_PRICE_ID_PRODUCER_PLUS,
  agency_owner: process.env.STRIPE_PRICE_ID_AGENCY,
};

// POST /api/billing/checkout-session — body: { tier: 'individual' | 'producer_plus' | 'agency_owner' }
// Creates (or reuses) a Stripe customer for this producer, then a Checkout Session for
// the requested plan. Returns { url } for the frontend to redirect the browser to.
router.post('/checkout-session', asyncHandler(async (req, res) => {
  const { tier } = req.body;
  const priceId = PRICE_BY_TIER[tier];
  if (!priceId) return res.status(400).json({ error: 'tier must be "individual", "producer_plus", or "agency_owner".' });

  const producer = await prisma.producer.findUnique({ where: { id: req.producerId } });

  // Already subscribed? Never start a second subscription (that would bill them twice) —
  // switch the existing one to the new plan instead. Stripe prorates the difference.
  if (producer.stripeSubscriptionId && !producer.isComped) {
    let current = null;
    try { current = await stripe.subscriptions.retrieve(producer.stripeSubscriptionId); } catch (e) { current = null; }
    if (current && ['active', 'past_due', 'trialing'].includes(current.status)) {
      const item = current.items.data[0];
      if (item.price.id === priceId) return res.status(409).json({ error: "You're already on this plan." });
      await stripe.subscriptions.update(current.id, {
        items: [{ id: item.id, price: priceId }],
        proration_behavior: 'create_prorations',
        cancel_at_period_end: false,
        metadata: { producerId: producer.id, tier },
      });
      await applyTierChange(prisma, producer.id, tier);
      return res.json({ changed: true, tier });
    }
  }

  let stripeCustomerId = producer.stripeCustomerId;
  // A saved customer id can point at a customer that no longer exists on this Stripe account
  // (e.g. it was created in Stripe's test mode and the app has since moved to live keys, or the
  // customer was deleted in the dashboard). Treat that as "no customer yet" and make a fresh one.
  if (stripeCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(stripeCustomerId);
      if (existing.deleted) stripeCustomerId = null;
    } catch (err) {
      if (err.code === 'resource_missing') stripeCustomerId = null;
      else throw err;
    }
  }
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: producer.email,
      name: producer.name,
      metadata: { producerId: producer.id },
    });
    stripeCustomerId = customer.id;
    await prisma.producer.update({ where: { id: producer.id }, data: { stripeCustomerId } });
  }

  const origin = `${req.protocol}://${req.get('host')}`;
  // Sales tax, worked out by Stripe from the customer's billing address. Behind an env switch
  // (STRIPE_AUTOMATIC_TAX=true) because Stripe rejects checkout if automatic tax is requested
  // before Stripe Tax is set up on the account — flip it on only after Stripe Tax is configured.
  const taxOptions = taxEnabled()
    ? {
        automatic_tax: { enabled: true },
        billing_address_collection: 'required',
        // Lets Stripe save the address and name the customer types onto their Stripe customer,
        // which it needs to calculate tax (and for later renewals).
        customer_update: { address: 'auto', name: 'auto' },
      }
    : {};
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    ...taxOptions,
    success_url: `${origin}/app.html?checkout=success`,
    cancel_url: `${origin}/app.html?checkout=cancelled`,
    metadata: { producerId: producer.id, tier },
    subscription_data: { metadata: { producerId: producer.id, tier } },
    // Shows an "Add promotion code" field on the Stripe-hosted checkout page.
    // Codes themselves are created and managed entirely in the Stripe Dashboard —
    // nothing to store or validate on our side.
    allow_promotion_codes: true,
  });

  res.json({ url: session.url });
}));

// POST /api/billing/portal-session — lets an already-subscribed producer manage or cancel
// their subscription via Stripe's hosted Customer Portal.
router.post('/portal-session', asyncHandler(async (req, res) => {
  const producer = await prisma.producer.findUnique({ where: { id: req.producerId } });
  if (!producer.stripeCustomerId) {
    return res.status(400).json({ error: 'No billing account yet — subscribe first.' });
  }

  const origin = `${req.protocol}://${req.get('host')}`;
  let session;
  try {
    session = await stripe.billingPortal.sessions.create({
      customer: producer.stripeCustomerId,
      return_url: `${origin}/app.html`,
    });
  } catch (err) {
    // The saved customer doesn't exist on this Stripe account (see checkout-session above).
    if (err.code === 'resource_missing') {
      return res.status(400).json({ error: 'No active billing account found. Choose a plan above to subscribe.' });
    }
    throw err;
  }

  res.json({ url: session.url });
}));

module.exports = router;
