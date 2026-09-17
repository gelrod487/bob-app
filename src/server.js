require('dotenv').config();
const express = require('express');

const { producerProfitability, agencyProfitability } = require('./lib/profitability');
const prisma = require('./lib/db');

const app = express();
app.use(express.json({ limit: '15mb' })); // generous limit for base64 workbook uploads in /import

// --- TEMPORARY auth shim -----------------------------------------------
// There is no real authentication in this scaffold yet (see README "Auth").
// Every request currently trusts an `x-producer-id` header naming which
// producer is "logged in" — obviously not production-safe. Replace this
// with real session/JWT auth before shipping, and remove this middleware.
app.use((req, res, next) => {
  req.producerId = req.header('x-producer-id') || null;
  if (!req.producerId) {
    return res.status(401).json({ error: 'Missing x-producer-id header (temporary auth shim — see README).' });
  }
  next();
});
// -------------------------------------------------------------------------

app.use('/api/clients', require('./routes/clients'));
app.use('/api/policies', require('./routes/policies'));
app.use('/api/commission-entries', require('./routes/commissionEntries'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/payment-reminders', require('./routes/paymentReminders'));
app.use('/api/owner-draws', require('./routes/ownerDraws'));
app.use('/api/import', require('./routes/import'));

// GET /api/dashboard — the numbers the mockup's dashboard tab needs, in one call.
app.get('/api/dashboard', async (req, res) => {
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
