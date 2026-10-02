const express = require('express');
const prisma = require('../lib/db');
const asyncHandler = require('../middleware/asyncHandler');
const { logAdminAction } = require('../lib/audit');
const { httpError } = require('../lib/httpError');
const { validateRateRow, planImport, MAX_IMPORT_ROWS } = require('../lib/rateRows');

// Mounted under /api/admin/rates (already behind requireAdmin). Unlike the producer-side
// routes, these have no 20-row bootstrap limit — this is the "IMO administrator" path those
// routes point people to when an IMO already has rates on file.
const router = express.Router();

const modelFor = (type) => {
  if (type === 'life') return prisma.imoCommissionRate;
  if (type === 'annuity') return prisma.annuityCommissionRate;
  throw httpError(400, 'type must be "life" or "annuity".');
};

// Rates are keyed by IMO name, so a typo here would silently create an orphan table nobody
// is looking at. Only accept names already in the directory, and store the directory's
// spelling.
async function canonicalImo(name) {
  const imo = typeof name === 'string' ? name.trim() : '';
  if (!imo) throw httpError(400, 'imoName is required.');
  const known = await prisma.knownImo.findFirst({ where: { name: { equals: imo, mode: 'insensitive' } } });
  if (!known) throw httpError(400, `"${imo}" isn't in the IMO directory. Add it on the IMOs tab first.`);
  return known.name;
}

const ordering = (type) => (type === 'annuity'
  ? [{ carrierName: 'asc' }, { productName: 'asc' }, { tier: 'asc' }]
  : [{ carrierName: 'asc' }, { productName: 'asc' }, { contractLevel: 'desc' }]);

// GET /api/admin/rates?type=life|annuity&imo=NAME
router.get('/', asyncHandler(async (req, res) => {
  const type = req.query.type || 'life';
  const imoName = await canonicalImo(req.query.imo);
  const rates = await modelFor(type).findMany({ where: { imoName: { equals: imoName, mode: 'insensitive' } }, orderBy: ordering(type) });
  res.json({ imo: imoName, type, rates });
}));

// POST /api/admin/rates — add or correct one row (upsert on the table's unique key).
router.post('/', asyncHandler(async (req, res) => {
  const type = req.body.type || 'life';
  const model = modelFor(type);
  const imoName = await canonicalImo(req.body.imoName);
  const v = validateRateRow(type, req.body);
  if (!v.ok) throw httpError(400, v.error);
  const where = type === 'annuity'
    ? { imoName_carrierName_productName_tier: { imoName, carrierName: v.row.carrierName, productName: v.row.productName, tier: v.row.tier } }
    : { imoName_carrierName_productName_contractLevel: { imoName, carrierName: v.row.carrierName, productName: v.row.productName, contractLevel: v.row.contractLevel } };
  const rate = await model.upsert({ where, create: { imoName, ...v.row }, update: { payoutRate: v.row.payoutRate } });
  await logAdminAction(req, 'rate.upsert', null, { type, imoName, ...v.row });
  res.status(201).json(rate);
}));

// PUT /api/admin/rates/:id — change the payout of an existing row. (Changing carrier,
// product, or level is a different row: delete and add.)
router.put('/:id', asyncHandler(async (req, res) => {
  const type = req.body.type || 'life';
  const model = modelFor(type);
  const existing = await model.findUnique({ where: { id: req.params.id } });
  if (!existing) throw httpError(404, 'Rate not found.');
  const v = validateRateRow(type, { ...existing, payoutRate: req.body.payoutRate });
  if (!v.ok) throw httpError(400, v.error);
  const updated = await model.update({ where: { id: existing.id }, data: { payoutRate: v.row.payoutRate } });
  await logAdminAction(req, 'rate.update', null, { type, imoName: existing.imoName, id: existing.id, from: Number(existing.payoutRate), to: v.row.payoutRate });
  res.json(updated);
}));

// DELETE /api/admin/rates/:id?type=
router.delete('/:id', asyncHandler(async (req, res) => {
  const type = req.query.type || 'life';
  const model = modelFor(type);
  const existing = await model.findUnique({ where: { id: req.params.id } });
  if (!existing) throw httpError(404, 'Rate not found.');
  await model.delete({ where: { id: existing.id } });
  await logAdminAction(req, 'rate.delete', null, { type, imoName: existing.imoName, carrierName: existing.carrierName, productName: existing.productName });
  res.json({ ok: true });
}));

async function plan(req) {
  const type = req.body.type || 'life';
  const model = modelFor(type);
  const imoName = await canonicalImo(req.body.imoName);
  const rows = req.body.rows;
  if (!Array.isArray(rows) || !rows.length) throw httpError(400, 'No rows to import.');
  if (rows.length > MAX_IMPORT_ROWS) throw httpError(400, `Too many rows (${rows.length}). The limit is ${MAX_IMPORT_ROWS} per import.`);
  const existing = await model.findMany({ where: { imoName } });
  return { type, model, imoName, plan: planImport(type, rows, existing) };
}

// POST /api/admin/rates/import/preview — what an import would do. Changes nothing.
router.post('/import/preview', asyncHandler(async (req, res) => {
  const { type, imoName, plan: p } = await plan(req);
  res.json({ type, imoName, creates: p.creates.length, updates: p.updates.length, unchanged: p.unchanged, errors: p.errors.slice(0, 50), errorCount: p.errors.length, sampleUpdates: p.updates.slice(0, 10).map((u) => ({ ...u.row, oldRate: u.oldRate })) });
}));

// POST /api/admin/rates/import/commit — all-or-nothing: any invalid row refuses the whole file,
// so a half-applied import can never leave an IMO's table in a mixed state.
router.post('/import/commit', asyncHandler(async (req, res) => {
  const { type, model, imoName, plan: p } = await plan(req);
  if (p.errors.length) throw httpError(400, `${p.errors.length} row(s) have problems (first: line ${p.errors[0].line} — ${p.errors[0].error}). Fix the file and preview again; nothing was imported.`);
  await prisma.$transaction(async (tx) => {
    const m = type === 'annuity' ? tx.annuityCommissionRate : tx.imoCommissionRate;
    if (p.creates.length) await m.createMany({ data: p.creates.map((r) => ({ imoName, ...r })) });
    for (const u of p.updates) await m.update({ where: { id: u.id }, data: { payoutRate: u.row.payoutRate } });
  }, { timeout: 60000 });
  await logAdminAction(req, 'rate.import', null, { type, imoName, created: p.creates.length, updated: p.updates.length, unchanged: p.unchanged });
  res.json({ created: p.creates.length, updated: p.updates.length, unchanged: p.unchanged });
}));

module.exports = router;
