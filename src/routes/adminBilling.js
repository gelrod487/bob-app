const express = require('express');
const prisma = require('../lib/db');
const stripe = require('../lib/stripe');
const asyncHandler = require('../middleware/asyncHandler');
const { isAdminEmail } = require('../middleware/auth');
const { httpError } = require('../lib/httpError');
const { getBillingSummary, customerDashboardUrl, stripeMode } = require('../lib/stripeBilling');

// Mounted under /api/admin/billing (already behind requireAdmin). Read-only: this never
// changes anything in Stripe or on a producer — fixing a mismatch is done deliberately
// elsewhere (plan/comp controls in Customers, or the Stripe dashboard).
const router = express.Router();

// GET /api/admin/billing — customers whose billing needs a look, grouped.
router.get('/', asyncHandler(async (req, res) => {
  const producers = await prisma.producer.findMany({
    where: { OR: [{ subscriptionStatus: { in: ['past_due', 'canceled'] } }, { isComped: true }, { stripeCustomerId: { not: null } }] },
    orderBy: { createdAt: 'desc' },
  });
  const mode = stripeMode();
  const row = (p) => ({
    id: p.id, name: p.name, email: p.email,
    subscriptionTier: p.subscriptionTier, subscriptionStatus: p.subscriptionStatus, isComped: p.isComped,
    stripeCustomerId: p.stripeCustomerId,
    dashboardUrl: p.stripeCustomerId ? customerDashboardUrl(p.stripeCustomerId, mode) : null,
  });
  const customers = producers.filter((p) => !isAdminEmail(p.email));
  res.json({
    mode,
    pastDue: customers.filter((p) => !p.isComped && p.subscriptionStatus === 'past_due').map(row),
    canceled: customers.filter((p) => !p.isComped && p.subscriptionStatus === 'canceled').map(row),
    // Has a Stripe customer (so checkout was started) but never became a subscriber.
    startedCheckout: customers.filter((p) => !p.isComped && p.stripeCustomerId && p.subscriptionStatus === 'inactive').map(row),
    comped: customers.filter((p) => p.isComped).map(row),
  });
}));

// GET /api/admin/billing/producer/:id — live Stripe state for one producer, with any
// disagreement against what BOB has stored.
router.get('/producer/:id', asyncHandler(async (req, res) => {
  const producer = await prisma.producer.findUnique({ where: { id: req.params.id } });
  if (!producer) throw httpError(404, 'Producer not found.');
  try {
    res.json(await getBillingSummary(producer, stripe));
  } catch (err) {
    // A Stripe outage / bad key / missing customer shouldn't look like a BOB crash.
    if (err && err.type && err.type.startsWith('Stripe')) {
      throw httpError(502, `Stripe lookup failed: ${err.message}`);
    }
    throw err;
  }
}));

module.exports = router;
