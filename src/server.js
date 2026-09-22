require('dotenv').config();
const path = require('path');
const express = require('express');

const { producerProfitability, agencyProfitability } = require('./lib/profitability');
const prisma = require('./lib/db');
const { requireAuth, requireProducer, requireAdmin, requireActiveOrTrial } = require('./middleware/auth');
const handleStripeWebhook = require('./routes/billingWebhook');
const asyncHandler = require('./middleware/asyncHandler');

const app = express();

// Stripe needs the exact raw request body to verify its signature, so this is registered
// BEFORE express.json() below and matched first — it never goes through the JSON parser
// or the Supabase auth middleware (Stripe authenticates via the signature instead).
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

app.use(express.json({ limit: '15mb' })); // generous limit for base64 workbook uploads in /import
app.use(express.static(path.join(__dirname, '..', 'public')));

// Every remaining /api/* route requires a valid Supabase session.
app.use('/api', requireAuth);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/me', require('./routes/me'));
app.use('/api/clients', requireProducer, requireActiveOrTrial, require('./routes/clients'));
app.use('/api/policies', requireProducer, requireActiveOrTrial, require('./routes/policies'));
app.use('/api/commission-entries', requireProducer, requireActiveOrTrial, require('./routes/commissionEntries'));
app.use('/api/expenses', requireProducer, requireActiveOrTrial, require('./routes/expenses'));
app.use('/api/payment-reminders', requireProducer, requireActiveOrTrial, require('./routes/paymentReminders'));
app.use('/api/owner-draws', requireProducer, requireActiveOrTrial, require('./routes/ownerDraws'));
app.use('/api/import', requireProducer, requireActiveOrTrial, require('./routes/import'));
// Deliberately no requireActiveOrTrial here — an expired producer must still be able to
// reach checkout-session/portal-session to subscribe and lift their own gate.
app.use('/api/billing', requireProducer, require('./routes/billing'));
app.use('/api/activity', requireProducer, requireActiveOrTrial, require('./routes/activity'));
app.use('/api/goals', requireProducer, requireActiveOrTrial, require('./routes/goals'));
app.use('/api/admin', requireAdmin, require('./routes/admin'));

// GET /api/dashboard — the numbers the mockup's dashboard tab needs, in one call.
app.get('/api/dashboard', requireProducer, requireActiveOrTrial, asyncHandler(async (req, res) => {
  const producer = await prisma.producer.findUnique({ where: { id: req.producerId } });
  if (!producer) return res.status(404).json({ error: 'Producer not found.' });

  if (producer.subscriptionTier === 'agency_owner' && producer.agencyId) {
    const stats = await agencyProfitability(producer.agencyId, req.query);
    return res.json({ tier: 'agency_owner', ...stats });
  }
  const stats = await producerProfitability(producer.id, req.query);
  res.json({ tier: 'individual', ...stats });
}));

// Final safety net: anything asyncHandler passes to next(err) lands here instead of
// crashing the process (this is what a bad Stripe/Prisma call used to do — see
// src/middleware/asyncHandler.js).
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our end.' });
});

// Extra defense-in-depth: if anything still slips through as an unhandled rejection
// (e.g. a background timer callback outside any request, like a retry inside a
// third-party SDK), log it instead of letting Node's default behavior kill the process.
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`BOB backend listening on :${port}`));
