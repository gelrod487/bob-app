const prisma = require('./db');

// The flag map a producer sees: { flagKey: true/false }. A flag is on when it's enabled for
// everyone, or when this producer is on its allowlist (so it can be tried with a few people
// before being turned on for all).
async function resolveFlags(producerId) {
  const flags = await prisma.featureFlag.findMany();
  const map = {};
  for (const f of flags) map[f.key] = f.enabled || f.allowlist.includes(producerId);
  return map;
}

module.exports = { resolveFlags };
