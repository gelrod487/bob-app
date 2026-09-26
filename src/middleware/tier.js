const prisma = require('../lib/db');
const asyncHandler = require('./asyncHandler');

// commission_entry.entry_type='override' must only ever have owner_type='agency' —
// this middleware assumes the authenticated producer's id is on req.producerId.

async function requireAgencyOwner(req, res, next) {
  const producer = await prisma.producer.findUnique({ where: { id: req.producerId } });
  if (!producer) return res.status(401).json({ error: 'Unknown producer.' });
  if (producer.subscriptionTier !== 'agency_owner') {
    return res.status(403).json({
      error: 'This action is only available on the Agency Owner plan.',
    });
  }
  // Not producer.agencyId — that's this producer's own MEMBERSHIP (whose team their
  // personal numbers count toward), which for a promoted downline is their upline's
  // agency, not the one they themselves own. See the Agency model's doc comment.
  const ownedAgency = await prisma.agency.findUnique({ where: { ownerId: producer.id } });
  if (!ownedAgency) {
    return res.status(403).json({
      error: 'This action is only available on the Agency Owner plan.',
    });
  }
  req.agencyId = ownedAgency.id;
  next();
}

// Gates the commission calculator: Producer Plus ($39/mo) or Agency Owner ($79/mo,
// which includes every Producer Plus feature) — not the base Producer tier.
async function requireProducerPlusOrAbove(req, res, next) {
  const producer = await prisma.producer.findUnique({ where: { id: req.producerId } });
  if (!producer) return res.status(401).json({ error: 'Unknown producer.' });
  if (!['producer_plus', 'agency_owner'].includes(producer.subscriptionTier)) {
    return res.status(403).json({
      error: 'The commission calculator is available on Producer Plus and Agency Owner plans.',
    });
  }
  req.producer = producer;
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
  requireProducerPlusOrAbove: asyncHandler(requireProducerPlusOrAbove),
  assertExpenseCategoryAllowed,
  assertCommissionEntryAllowed,
};
