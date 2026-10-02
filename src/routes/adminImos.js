const express = require('express');
const prisma = require('../lib/db');
const asyncHandler = require('../middleware/asyncHandler');
const { logAdminAction } = require('../lib/audit');
const { findTypoMatch } = require('../lib/knownImos');
const { httpError } = require('../lib/httpError');

// Mounted under /api/admin/imos (already behind requireAdmin). IMO names are free text
// everywhere (Producer.imo, ImoCommissionRate.imoName, AnnuityCommissionRate.imoName —
// no foreign keys), so "renaming" or "merging" one means rewriting all three places in a
// single transaction.
const router = express.Router();

const insensitive = (name) => ({ equals: name, mode: 'insensitive' });

async function countReferences(db, name) {
  const [producers, lifeRates, annuityRates] = await Promise.all([
    db.producer.count({ where: { imo: insensitive(name) } }),
    db.imoCommissionRate.count({ where: { imoName: insensitive(name) } }),
    db.annuityCommissionRate.count({ where: { imoName: insensitive(name) } }),
  ]);
  return { producers, lifeRates, annuityRates };
}

// Points every reference to `from` at `to`. A pure re-casing (same name ignoring case)
// can't collide with itself, but a real merge can: both IMOs might already have a rate
// row for the same carrier/product/level, which the unique keys would reject mid-update —
// so check first and refuse with a clear message instead of failing halfway.
async function rewriteImoReferences(tx, from, to) {
  const sameName = from.toLowerCase() === to.toLowerCase();
  if (!sameName) {
    const lifeRows = await tx.imoCommissionRate.findMany({ where: { imoName: insensitive(from) } });
    for (const r of lifeRows) {
      const clash = await tx.imoCommissionRate.findFirst({
        where: { imoName: insensitive(to), carrierName: r.carrierName, productName: r.productName, contractLevel: r.contractLevel },
      });
      if (clash) throw httpError(409, `Can't merge: "${to}" already has a life rate for ${r.carrierName} / ${r.productName} at ${r.contractLevel}%. Resolve the overlap in rate management first.`);
    }
    const annuityRows = await tx.annuityCommissionRate.findMany({ where: { imoName: insensitive(from) } });
    for (const r of annuityRows) {
      const clash = await tx.annuityCommissionRate.findFirst({
        where: { imoName: insensitive(to), carrierName: r.carrierName, productName: r.productName, tier: r.tier },
      });
      if (clash) throw httpError(409, `Can't merge: "${to}" already has an annuity rate for ${r.carrierName} / ${r.productName} at the ${r.tier} tier. Resolve the overlap in rate management first.`);
    }
  }
  const [producers, life, annuity] = await Promise.all([
    tx.producer.updateMany({ where: { imo: insensitive(from) }, data: { imo: to } }),
    tx.imoCommissionRate.updateMany({ where: { imoName: insensitive(from) }, data: { imoName: to } }),
    tx.annuityCommissionRate.updateMany({ where: { imoName: insensitive(from) }, data: { imoName: to } }),
  ]);
  return { producers: producers.count, lifeRates: life.count, annuityRates: annuity.count };
}

function cleanName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) throw httpError(400, 'An IMO name is required.');
  if (name.length > 120) throw httpError(400, 'IMO name is too long.');
  return name;
}

// GET /api/admin/imos — the directory, each entry with how many producers and rate rows
// currently point at it.
router.get('/', asyncHandler(async (req, res) => {
  const [known, producerGroups, lifeGroups, annuityGroups] = await Promise.all([
    prisma.knownImo.findMany({ orderBy: { name: 'asc' } }),
    prisma.producer.groupBy({ by: ['imo'], where: { imo: { not: null } }, _count: { _all: true } }),
    prisma.imoCommissionRate.groupBy({ by: ['imoName'], _count: { _all: true } }),
    prisma.annuityCommissionRate.groupBy({ by: ['imoName'], _count: { _all: true } }),
  ]);
  const tally = (groups, key) => {
    const map = new Map();
    for (const g of groups) {
      const k = g[key].trim().toLowerCase();
      map.set(k, (map.get(k) || 0) + g._count._all);
    }
    return map;
  };
  const producers = tally(producerGroups, 'imo');
  const life = tally(lifeGroups, 'imoName');
  const annuity = tally(annuityGroups, 'imoName');
  res.json(known.map((k) => {
    const key = k.name.toLowerCase();
    return {
      id: k.id,
      name: k.name,
      producerCount: producers.get(key) || 0,
      lifeRateRows: life.get(key) || 0,
      annuityRateRows: annuity.get(key) || 0,
    };
  }));
}));

// GET /api/admin/imos/pending — IMO names in use (typed by a producer, or sitting in a rate
// table) that aren't in the directory yet. Derived on the fly; nothing is stored. Each one
// carries the closest directory name (if any) so a likely typo can be merged in one click.
router.get('/pending', asyncHandler(async (req, res) => {
  const [known, producerGroups, lifeGroups, annuityGroups] = await Promise.all([
    prisma.knownImo.findMany({ select: { name: true } }),
    prisma.producer.groupBy({ by: ['imo'], where: { imo: { not: null } }, _count: { _all: true } }),
    prisma.imoCommissionRate.groupBy({ by: ['imoName'], _count: { _all: true } }),
    prisma.annuityCommissionRate.groupBy({ by: ['imoName'], _count: { _all: true } }),
  ]);
  const knownNames = known.map((k) => k.name);
  const knownKeys = new Set(knownNames.map((n) => n.toLowerCase()));

  const pending = new Map(); // lowercase -> { name, producerCount, rateRows }
  const touch = (rawName, field, count) => {
    const name = rawName.trim();
    const key = name.toLowerCase();
    if (!key || knownKeys.has(key)) return;
    const entry = pending.get(key) || { name, producerCount: 0, rateRows: 0 };
    entry[field] += count;
    pending.set(key, entry);
  };
  producerGroups.forEach((g) => touch(g.imo, 'producerCount', g._count._all));
  lifeGroups.forEach((g) => touch(g.imoName, 'rateRows', g._count._all));
  annuityGroups.forEach((g) => touch(g.imoName, 'rateRows', g._count._all));

  res.json([...pending.values()]
    .map((p) => ({ ...p, suggestion: findTypoMatch(p.name, knownNames) }))
    .sort((a, b) => b.producerCount - a.producerCount || a.name.localeCompare(b.name)));
}));

// POST /api/admin/imos — add a name to the directory.
router.post('/', asyncHandler(async (req, res) => {
  const name = cleanName(req.body.name);
  const dupe = await prisma.knownImo.findFirst({ where: { name: insensitive(name) } });
  if (dupe) return res.status(409).json({ error: `"${dupe.name}" is already in the directory.` });

  // If producers already typed this name with different casing, snap them to the canonical
  // spelling now, so approving a pending IMO also cleans it up.
  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.knownImo.create({ data: { name } });
    const rewritten = await rewriteImoReferences(tx, name, name);
    return { created, rewritten };
  });
  await logAdminAction(req, 'imo.add', null, { name, rewritten: result.rewritten });
  res.status(201).json(result.created);
}));

// PUT /api/admin/imos/:id — rename a directory entry and everything pointing at it.
router.put('/:id', asyncHandler(async (req, res) => {
  const name = cleanName(req.body.name);
  const existing = await prisma.knownImo.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'IMO not found.' });
  const dupe = await prisma.knownImo.findFirst({ where: { name: insensitive(name), id: { not: existing.id } } });
  if (dupe) return res.status(409).json({ error: `"${dupe.name}" already exists — use Merge to combine them.` });

  const rewritten = await prisma.$transaction(async (tx) => {
    const counts = await rewriteImoReferences(tx, existing.name, name);
    await tx.knownImo.update({ where: { id: existing.id }, data: { name } });
    return counts;
  });
  await logAdminAction(req, 'imo.rename', null, { from: existing.name, to: name, rewritten });
  res.json({ id: existing.id, name, rewritten });
}));

// POST /api/admin/imos/merge { from, into } — fold a stray/typo name into a directory
// entry. `from` can be a pending name or another directory entry (which is then removed).
router.post('/merge', asyncHandler(async (req, res) => {
  const from = cleanName(req.body.from);
  const target = await prisma.knownImo.findFirst({ where: { name: insensitive(cleanName(req.body.into)) } });
  if (!target) return res.status(404).json({ error: 'The merge target must already be in the directory.' });
  if (from.toLowerCase() === target.name.toLowerCase()) return res.status(400).json({ error: 'Pick two different IMOs.' });

  const rewritten = await prisma.$transaction(async (tx) => {
    const counts = await rewriteImoReferences(tx, from, target.name);
    await tx.knownImo.deleteMany({ where: { name: insensitive(from) } });
    return counts;
  });
  await logAdminAction(req, 'imo.merge', null, { from, into: target.name, rewritten });
  res.json({ into: target.name, rewritten });
}));

// DELETE /api/admin/imos/:id — only when nothing references it.
router.delete('/:id', asyncHandler(async (req, res) => {
  const existing = await prisma.knownImo.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'IMO not found.' });
  const refs = await countReferences(prisma, existing.name);
  if (refs.producers || refs.lifeRates || refs.annuityRates) {
    return res.status(409).json({
      error: `Can't delete "${existing.name}" — ${refs.producers} producer(s) and ${refs.lifeRates + refs.annuityRates} rate row(s) still use it. Merge it into another IMO instead.`,
    });
  }
  await prisma.knownImo.delete({ where: { id: existing.id } });
  await logAdminAction(req, 'imo.delete', null, { name: existing.name });
  res.json({ ok: true });
}));

module.exports = router;
