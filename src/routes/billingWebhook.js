const stripe = require('../lib/stripe');
const prisma = require('../lib/db');
const asyncHandler = require('../middleware/asyncHandler');

// Mounted in server.js with express.raw() BEFORE the global express.json() middleware —
// Stripe's signature check needs the exact raw request body, not a parsed/re-serialized one.
// Not behind requireAuth: Stripe calls this directly, authenticated by the signature below
// instead of a Supabase session.
const handleStripeWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const { producerId, tier } = session.metadata || {};
      if (producerId) {
        // A producer who signed up as Producer and later subscribes to Agency here
        // (rather than choosing Agency at initial sign-up, where src/routes/auth.js
        // creates one) won't have an Agency row yet — create one so the agency-wide
        // dashboard actually has something to roll up into.
        let agencyId;
        if (tier === 'agency_owner') {
          const producer = await prisma.producer.findUnique({ where: { id: producerId } });
          agencyId = producer?.agencyId;
          if (!agencyId) {
            const agency = await prisma.agency.create({ data: { name: `${producer.name}'s Agency` } });
            agencyId = agency.id;
          }
        }
        await prisma.producer.update({
          where: { id: producerId },
          data: {
            subscriptionStatus: 'active',
            subscriptionTier: tier || undefined,
            stripeSubscriptionId: session.subscription || undefined,
            agencyId: agencyId || undefined,
          },
        });
      }
      break;
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const producerId = subscription.metadata?.producerId;
      if (producerId) {
        const status = subscription.status === 'active' ? 'active'
          : subscription.status === 'past_due' ? 'past_due'
          : subscription.cancel_at_period_end ? 'active'
          : 'inactive';
        await prisma.producer.update({
          where: { id: producerId },
          data: { subscriptionStatus: status },
        });
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const producerId = subscription.metadata?.producerId;
      if (producerId) {
        await prisma.producer.update({
          where: { id: producerId },
          data: { subscriptionStatus: 'canceled' },
        });
      }
      break;
    }
    default:
      break; // ignore events we don't act on
  }

  res.json({ received: true });
});

module.exports = handleStripeWebhook;
