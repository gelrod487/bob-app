const express = require('express');
const prisma = require('../lib/db');
const asyncHandler = require('../middleware/asyncHandler');
const { trialEndsAt, isAdminEmail, isTrialing } = require('../middleware/auth');
const { getKnownImoNames, findTypoMatch } = require('../lib/knownImos');

const router = express.Router();

// GET /api/me — the frontend's one-call source of truth for "who is logged in, what plan
// are they on, do they still need to finish sign-up." Deliberately does NOT use
// requireProducer, since a null producer (not-yet-bootstrapped) is a valid, expected state.
router.get('/', asyncHandler(async (req, res) => {
  if (!req.producerId) return res.json({ producer: null });

  const producer = await prisma.producer.findUnique({ where: { id: req.producerId } });
  const endsAt = trialEndsAt(producer);
  const isAdmin = isAdminEmail(req.supabaseUser.email);
  // Admin (internal team) accounts are exempt from the trial/subscription gate entirely —
  // see requireActiveOrTrial. Computed here too so this field is self-consistent on its own,
  // not just correct because the frontend happens to also check isAdmin separately.
  const trialExpired = !isAdmin && !producer.isComped && !['active', 'past_due'].includes(producer.subscriptionStatus) && new Date() >= endsAt;

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
      imo: producer.imo,
      contractLevel: producer.contractLevel,
      annuityTier: producer.annuityTier,
      subscriptionTier: producer.subscriptionTier,
      subscriptionStatus: producer.subscriptionStatus,
      trialEndsAt: endsAt.toISOString(),
      trialExpired,
      // Producer Plus-level features (Commission Calculator, Analytics) — available on
      // the Producer Plus/Agency Owner tiers, or to ANY tier still inside its 14-day
      // trial, so the trial shows off the more robust version of BOB regardless of which
      // plan was picked at signup. See requireProducerPlusOrAbove in middleware/tier.js,
      // which enforces the same rule server-side for the data those features read.
      hasPlusFeatures: ['producer_plus', 'agency_owner'].includes(producer.subscriptionTier) || isTrialing(producer),
      isAdmin,
    },
  });
}));

const VALID_ANNUITY_TIERS = ['green', 'yellow', 'blue', 'silver', 'gold', 'platinum', 'black', 'royal', 'red'];

// PUT /api/me — lets a producer edit their own profile. Deliberately narrow: just the
// fields Settings actually exposes (imo, contractLevel, annuityTier) — name/email changes
// would need to touch Supabase auth too, out of scope for now.
router.put('/', asyncHandler(async (req, res) => {
  if (!req.producerId) return res.status(409).json({ error: 'Finish setting up your account first.' });

  let { imo, contractLevel, annuityTier, imoOverride } = req.body;
  if (annuityTier && !VALID_ANNUITY_TIERS.includes(annuityTier)) {
    return res.status(400).json({ error: `annuityTier must be one of: ${VALID_ANNUITY_TIERS.join(', ')}` });
  }
  // The Settings page offers an autocomplete of known IMO names, but nothing stops
  // someone from ignoring it and typing their own variant — normalize case-insensitively
  // against whatever's already on file (a producer's imo, or an existing rate row) so
  // "family first life" and "Family First Life" resolve to the SAME shared commission
  // schedule instead of silently forking into two. First-seen spelling wins.
  if (imo) {
    const trimmed = imo.trim();
    const [existingProducer, existingRate] = await Promise.all([
      prisma.producer.findFirst({ where: { imo: { equals: trimmed, mode: 'insensitive' } }, select: { imo: true } }),
      prisma.imoCommissionRate.findFirst({ where: { imoName: { equals: trimmed, mode: 'insensitive' } }, select: { imoName: true } }),
    ]);
    const exactMatch = existingProducer?.imo || existingRate?.imoName;

    if (exactMatch) {
      imo = exactMatch;
    } else if (!imoOverride) {
      // No exact (case-insensitive) match — this is either a genuinely new IMO or a
      // typo of an existing one ("Famly First Life"). Check for a close-but-not-exact
      // match before treating it as new; if found, don't save yet — ask the client to
      // confirm first (it'll either resubmit with the suggestion or with imoOverride:
      // true to force the as-typed spelling as a new IMO).
      const knownNames = await getKnownImoNames();
      const suggestion = findTypoMatch(trimmed, knownNames);
      if (suggestion) {
        return res.json({ requiresConfirmation: true, suggestion, imoPending: trimmed });
      }
      imo = trimmed;
    } else {
      imo = trimmed;
    }
  }

  const updated = await prisma.producer.update({
    where: { id: req.producerId },
    data: {
      imo: imo !== undefined ? (imo || null) : undefined,
      contractLevel: contractLevel !== undefined ? (contractLevel === null ? null : Number(contractLevel)) : undefined,
      annuityTier: annuityTier !== undefined ? (annuityTier || null) : undefined,
    },
  });
  res.json({ imo: updated.imo, contractLevel: updated.contractLevel, annuityTier: updated.annuityTier });
}));

module.exports = router;
