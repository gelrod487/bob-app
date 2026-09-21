const express = require('express');
const stripe = require('../lib/stripe');
const prisma = require('../lib/db');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

const PRICE_BY_TIER = {
  individual: process.env.STRIPE_PRICE_ID_INDIVIDUAL,
  agency_owner: process.env.STRIPE_PRICE_ID_AGENCY,
};

// POST /api/billing/checkout-session — body: { tier: 'individual' | 'agency_owner' }
// Creates (or reuses) a Stripe customer for this producer, then a Checkout Session for
// the requested plan. Returns { url } for the frontend to redirect the browser to.
router.post('/checkout-session', asyncHandler(async (req, res) => {
  const { tier } = req.body;
  const priceId = PRICE_BY_TIER[tier];
  if (!priceId) return res.status(400).json({ error: 'tier must be "individual" or "agency_owner".' });

  const producer = await prisma.producer.findUnique({ where: { id: req.producerId } });

  let stripeCustomerId = producer.stripeCustomerId;
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
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
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
  const session = await stripe.billingPortal.sessions.create({
    customer: producer.stripeCustomerId,
    return_url: `${origin}/app.html`,
  });

  res.json({ url: session.url });
}));

module.exports = router;
