const express = require('express');
const prisma = require('../lib/db');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// GET /api/imos — every IMO name already known to BOB, for the Settings page's IMO
// autocomplete. Sourced from two places: any producer who has already set one (covers
// an IMO nobody's populated the calculator for yet) and the commission-rate table itself
// (covers an IMO whose rates exist but whose original entrant, for whatever reason, no
// longer has it set). Deduped case-insensitively, but preserves whichever exact spelling
// showed up first — that's what makes autocomplete actually converge everyone at the
// same IMO on the same string instead of forking on capitalization.
router.get('/', asyncHandler(async (req, res) => {
  const [fromProducers, fromRates] = await Promise.all([
    prisma.producer.findMany({ where: { imo: { not: null } }, select: { imo: true }, distinct: ['imo'] }),
    prisma.imoCommissionRate.findMany({ select: { imoName: true }, distinct: ['imoName'] }),
  ]);

  const seen = new Map(); // lowercase -> first-seen exact spelling
  for (const name of [...fromProducers.map((p) => p.imo), ...fromRates.map((r) => r.imoName)]) {
    const key = name.trim().toLowerCase();
    if (key && !seen.has(key)) seen.set(key, name.trim());
  }

  const imos = [...seen.values()].sort((a, b) => a.localeCompare(b));
  res.json({ imos });
}));

module.exports = router;
