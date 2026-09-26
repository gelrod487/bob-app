const express = require('express');
const prisma = require('../lib/db');
const { requireProducerPlusOrAbove } = require('../middleware/tier');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(requireProducerPlusOrAbove);

// Below this many rows, an IMO is still "bootstrapping" and self-service add/correct/
// delete stays open to whoever's building out its table. At or above it, the IMO is
// treated as established (e.g. FFL's comp-guide-sourced 1,325 rows) and this self-service
// path closes — further corrections go through the IMO administrator instead, so one
// producer can't silently corrupt a table everyone else at that IMO already relies on.
const BOOTSTRAP_ROW_LIMIT = 20;

// GET /api/commission-schedule — the calculator's data source: every carrier/product
// rate row for this producer's own IMO (see Producer.imo and the ImoCommissionRate doc
// comment). Shared by IMO name, not owned by one producer — everyone at the same IMO
// sees the same table, and it's empty (not an error) until someone at that IMO adds
// rows, which is exactly how BOB supports an IMO it has no data for yet.
router.get('/', asyncHandler(async (req, res) => {
  if (!req.producer.imo) return res.json({ imo: null, rates: [] });

  const rates = await prisma.imoCommissionRate.findMany({
    where: { imoName: req.producer.imo },
    orderBy: [{ carrierName: 'asc' }, { productName: 'asc' }, { contractLevel: 'desc' }],
  });
  res.json({ imo: req.producer.imo, rates });
}));

// POST /api/commission-schedule — add or correct a single rate row for the caller's own
// IMO. This is how an IMO with no data yet gets populated — by whoever's actually using
// it, since BOB has no legitimate way to source another organization's comp data itself.
// Once an IMO actually has rates on file (e.g. FFL's comp-guide-sourced table), this
// self-service path is closed off — any producer being able to silently overwrite
// verified rates would corrupt the shared table for everyone at that IMO.
router.post('/', asyncHandler(async (req, res) => {
  if (!req.producer.imo) {
    return res.status(400).json({ error: 'Set your IMO in Settings before adding commission rates.' });
  }

  const existingCount = await prisma.imoCommissionRate.count({ where: { imoName: req.producer.imo } });
  if (existingCount >= BOOTSTRAP_ROW_LIMIT) {
    return res.status(403).json({ error: `${req.producer.imo} already has rates on file. Contact your IMO administrator to correct one.` });
  }

  const { carrierName, productName, contractLevel, payoutRate } = req.body;
  if (!carrierName || !productName || contractLevel === undefined || payoutRate === undefined) {
    return res.status(400).json({ error: 'carrierName, productName, contractLevel, and payoutRate are required.' });
  }

  const rate = await prisma.imoCommissionRate.upsert({
    where: {
      imoName_carrierName_productName_contractLevel: {
        imoName: req.producer.imo,
        carrierName,
        productName,
        contractLevel: Number(contractLevel),
      },
    },
    create: {
      imoName: req.producer.imo, carrierName, productName,
      contractLevel: Number(contractLevel), payoutRate: Number(payoutRate),
    },
    update: { payoutRate: Number(payoutRate) },
  });
  res.status(201).json(rate);
}));

// DELETE /api/commission-schedule/:id — same bootstrap-only restriction as POST above.
router.delete('/:id', asyncHandler(async (req, res) => {
  const existingCount = await prisma.imoCommissionRate.count({ where: { imoName: req.producer.imo } });
  if (existingCount >= BOOTSTRAP_ROW_LIMIT) {
    return res.status(403).json({ error: `${req.producer.imo} already has rates on file. Contact your IMO administrator to correct one.` });
  }

  const rate = await prisma.imoCommissionRate.findFirst({
    where: { id: req.params.id, imoName: req.producer.imo },
  });
  if (!rate) return res.status(404).json({ error: 'Rate not found.' });
  await prisma.imoCommissionRate.delete({ where: { id: rate.id } });
  res.json({ ok: true });
}));

module.exports = router;
