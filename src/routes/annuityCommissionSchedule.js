const express = require('express');
const prisma = require('../lib/db');
const { requireProducerPlusOrAbove } = require('../middleware/tier');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(requireProducerPlusOrAbove);

// See commissionSchedule.js's doc comment on the same constant — identical rationale,
// just for the annuity table instead of the life/term one.
const BOOTSTRAP_ROW_LIMIT = 20;
const VALID_TIERS = ['green', 'yellow', 'blue', 'silver', 'gold', 'platinum', 'black', 'royal', 'red'];

// GET /api/annuity-commission-schedule — the calculator's Annuities-tab data source:
// every carrier/product rate row for this producer's own IMO, keyed by production tier
// instead of contract level (see AnnuityCommissionRate's doc comment in schema.prisma).
router.get('/', asyncHandler(async (req, res) => {
  if (!req.producer.imo) return res.json({ imo: null, rates: [] });

  const rates = await prisma.annuityCommissionRate.findMany({
    where: { imoName: req.producer.imo },
    orderBy: [{ carrierName: 'asc' }, { productName: 'asc' }],
  });
  res.json({ imo: req.producer.imo, rates });
}));

// POST /api/annuity-commission-schedule — add or correct a single rate row. Same
// bootstrap-only restriction as commissionSchedule.js's POST.
router.post('/', asyncHandler(async (req, res) => {
  if (!req.producer.imo) {
    return res.status(400).json({ error: 'Set your IMO in Settings before adding commission rates.' });
  }

  const existingCount = await prisma.annuityCommissionRate.count({ where: { imoName: req.producer.imo } });
  if (existingCount >= BOOTSTRAP_ROW_LIMIT) {
    return res.status(403).json({ error: `${req.producer.imo} already has annuity rates on file. Contact your IMO administrator to correct one.` });
  }

  const { carrierName, productName, tier, payoutRate } = req.body;
  if (!carrierName || !productName || !tier || payoutRate === undefined) {
    return res.status(400).json({ error: 'carrierName, productName, tier, and payoutRate are required.' });
  }
  if (!VALID_TIERS.includes(tier)) {
    return res.status(400).json({ error: `tier must be one of: ${VALID_TIERS.join(', ')}` });
  }

  const rate = await prisma.annuityCommissionRate.upsert({
    where: {
      imoName_carrierName_productName_tier: {
        imoName: req.producer.imo, carrierName, productName, tier,
      },
    },
    create: { imoName: req.producer.imo, carrierName, productName, tier, payoutRate: Number(payoutRate) },
    update: { payoutRate: Number(payoutRate) },
  });
  res.status(201).json(rate);
}));

// DELETE /api/annuity-commission-schedule/:id — same bootstrap-only restriction as POST.
router.delete('/:id', asyncHandler(async (req, res) => {
  const existingCount = await prisma.annuityCommissionRate.count({ where: { imoName: req.producer.imo } });
  if (existingCount >= BOOTSTRAP_ROW_LIMIT) {
    return res.status(403).json({ error: `${req.producer.imo} already has annuity rates on file. Contact your IMO administrator to correct one.` });
  }

  const rate = await prisma.annuityCommissionRate.findFirst({
    where: { id: req.params.id, imoName: req.producer.imo },
  });
  if (!rate) return res.status(404).json({ error: 'Rate not found.' });
  await prisma.annuityCommissionRate.delete({ where: { id: rate.id } });
  res.json({ ok: true });
}));

module.exports = router;
