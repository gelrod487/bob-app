const prisma = require('../lib/db');
const asyncHandler = require('./asyncHandler');

// commission_entry.entry_type='override' must only ever have owner_type='agency' —
// this middleware assumes the authenticated producer's id is on req.producerId.

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

// Expense categories are a flat list shared by every plan today — nothing is
// agency-only anymore, but this stays in place as the one spot to enforce a
// future tier rule if one shows up again.
function assertExpenseCategoryAllowed() {}

// Same idea for override commission entries.
function assertCommissionEntryAllowed({ entryType, ownerType }) {
  if (entryType === 'override' && ownerType !== 'agency') {
    throw new Error('Override entries can only be logged at the agency level.');
  }
}

module.exports = {
  requireAgencyOwner: asyncHandler(requireAgencyOwner),
  assertExpenseCategoryAllowed,
  assertCommissionEntryAllowed,
};
