const prisma = require('../lib/db');

// bob-schema.md calls out two rules that need enforcing in code, not SQL:
//   1. expense.category IN ('staff','recruiting') must only ever have owner_type='agency'
//   2. commission_entry.entry_type='override' must only ever have owner_type='agency'
// This middleware assumes the authenticated producer's id is on req.producerId —
// wire that up once real auth exists (see README "Auth" section).

async function requireAgencyOwner(req, res, next) {
  const producer = await prisma.producer.findUnique({ where: { id: req.producerId } });
  if (!producer) return res.status(401).json({ error: 'Unknown producer.' });
  if (producer.subscriptionTier !== 'agency_owner' || !producer.agencyId) {
    return res.status(403).json({
      error: 'This action is only available on the Agency Owner plan.',
    });
  }
  req.agencyId = producer.agencyId;
  next();
}

// Validates an expense payload against the tier rule before it ever reaches Prisma.
function assertExpenseCategoryAllowed({ category, ownerType }) {
  const agencyOnly = ['staff', 'recruiting'];
  if (agencyOnly.includes(category) && ownerType !== 'agency') {
    throw new Error(`"${category}" expenses can only be logged at the agency level.`);
  }
}

// Same idea for override commission entries.
function assertCommissionEntryAllowed({ entryType, ownerType }) {
  if (entryType === 'override' && ownerType !== 'agency') {
    throw new Error('Override entries can only be logged at the agency level.');
  }
}

module.exports = { requireAgencyOwner, assertExpenseCategoryAllowed, assertCommissionEntryAllowed };
