const express = require('express');
const prisma = require('../lib/db');
const asyncHandler = require('../middleware/asyncHandler');
const { trialEndsAt } = require('../middleware/auth');

const router = express.Router();

// GET /api/me — the frontend's one-call source of truth for "who is logged in, what plan
// are they on, do they still need to finish sign-up." Deliberately does NOT use
// requireProducer, since a null producer (not-yet-bootstrapped) is a valid, expected state.
router.get('/', asyncHandler(async (req, res) => {
  if (!req.producerId) return res.json({ producer: null });

  const producer = await prisma.producer.findUnique({ where: { id: req.producerId } });
  const endsAt = trialEndsAt(producer);
  const trialExpired = !['active', 'past_due'].includes(producer.subscriptionStatus) && new Date() >= endsAt;

  // agencyId is MEMBERSHIP (whose team this producer's own personal numbers count
  // toward); ownedAgencyId is OWNERSHIP (the agency this producer manages, if any) — see
  // the Agency model's doc comment for why a promoted downline needs both, distinctly.
  const ownedAgency = producer.subscriptionTier === 'agency_owner'
    ? await prisma.agency.findUnique({ where: { ownerId: producer.id } })
    : null;

  res.json({
    producer: {
      id: producer.id,
      name: producer.name,
      email: producer.email,
      agencyId: producer.agencyId,
      ownedAgencyId: ownedAgency?.id || null,
      subscriptionTier: producer.subscriptionTier,
      subscriptionStatus: producer.subscriptionStatus,
      trialEndsAt: endsAt.toISOString(),
      trialExpired,
    },
  });
}));

module.exports = router;
