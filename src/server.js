require('dotenv').config();
const path = require('path');
const express = require('express');

const { producerProfitability, agencyProfitability } = require('./lib/profitability');
const prisma = require('./lib/db');
const { requireAuth, requireProducer } = require('./middleware/auth');
const handleStripeWebhook = require('./routes/billingWebhook');

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
app.use('/api/clients', requireProducer, require('./routes/clients'));
app.use('/api/policies', requireProducer, require('./routes/policies'));
app.use('/api/commission-entries', requireProducer, require('./routes/commissionEntries'));
app.use('/api/expenses', requireProducer, require('./routes/expenses'));
app.use('/api/payment-reminders', requireProducer, require('./routes/paymentReminders'));
app.use('/api/owner-draws', requireProducer, require('./routes/ownerDraws'));
app.use('/api/import', requireProducer, require('./routes/import'));
app.use('/api/billing', requireProducer, require('./routes/billing'));

// GET /api/dashboard — the numbers the mockup's dashboard tab needs, in one call.
app.get('/api/dashboard', requireProducer, async (req, res) => {
  const producer = await prisma.producer.findUnique({ where: { id: req.producerId } });
  if (!producer) return res.status(404).json({ error: 'Producer not found.' });

  if (producer.subscriptionTier === 'agency_owner' && producer.agencyId) {
    const stats = await agencyProfitability(producer.agencyId, req.query);
    return res.json({ tier: 'agency_owner', ...stats });
  }
  const stats = await producerProfitability(producer.id, req.query);
  res.json({ tier: 'individual', ...stats });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`BOB backend listening on :${port}`));
