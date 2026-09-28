const prisma = require('./db');
const { levenshtein } = require('./levenshtein');

// Every IMO name already known to BOB, deduped case-insensitively but keeping whichever
// exact spelling showed up first — shared by the /api/imos autocomplete and the fuzzy-
// match check in PUT /api/me, so both agree on the same canonical spelling.
async function getKnownImoNames() {
  const [fromProducers, fromRates] = await Promise.all([
    prisma.producer.findMany({ where: { imo: { not: null } }, select: { imo: true }, distinct: ['imo'] }),
    prisma.imoCommissionRate.findMany({ select: { imoName: true }, distinct: ['imoName'] }),
  ]);

  const seen = new Map(); // lowercase -> first-seen exact spelling
  for (const name of [...fromProducers.map((p) => p.imo), ...fromRates.map((r) => r.imoName)]) {
    const key = name.trim().toLowerCase();
    if (key && !seen.has(key)) seen.set(key, name.trim());
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

// Tolerance scales with name length — short names get less wiggle room, since a distance
// of 2 on a 4-letter name is nearly a different word, but the same distance on a longer
// name is plausibly just a couple of typos.
function maxTypoDistance(length) {
  if (length <= 4) return 1;
  if (length <= 8) return 2;
  return 3;
}

// Finds the closest known IMO name to `name` that ISN'T an exact (case-insensitive)
// match, within typo tolerance. Returns null if nothing's close enough — that means
// `name` is either an exact match already (handled separately) or a genuinely new IMO.
function findTypoMatch(name, knownNames) {
  const target = name.trim().toLowerCase();
  let best = null;
  let bestDistance = Infinity;
  for (const known of knownNames) {
    const candidate = known.toLowerCase();
    if (candidate === target) continue;
    const distance = levenshtein(target, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = known;
    }
  }
  if (best && bestDistance <= maxTypoDistance(target.length)) return best;
  return null;
}

module.exports = { getKnownImoNames, findTypoMatch };
