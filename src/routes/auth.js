const express = require('express');
const prisma = require('../lib/db');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// POST /api/auth/bootstrap — called once, right after Supabase sign-up (or first sign-in),
// to create the app-level Producer row for a Supabase Auth user. Safe to call again for an
// already-bootstrapped user: it just returns the existing Producer.
router.post('/bootstrap', asyncHandler(async (req, res) => {
  const existing = await prisma.producer.findUnique({ where: { supabaseUserId: req.supabaseUser.id } });
  if (existing) return res.json(existing);

  const { name, tier, agencyName, inviteAgencyId } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required.' });

  // Signing up via an agency owner's invite link joins that agency as a regular producer.
  // They still get their own trial and still need their own subscription afterward (see
  // requireActiveOrTrial) — the invite only decides whose team their numbers roll up
  // into, so tier/agencyName from the form are ignored in favor of the invite.
  if (inviteAgencyId) {
    const agency = await prisma.agency.findUnique({ where: { id: inviteAgencyId } });
    if (!agency) return res.status(400).json({ error: 'This invite link is no longer valid.' });

    const producer = await prisma.producer.create({
      data: {
        name,
        email: req.supabaseUser.email,
        supabaseUserId: req.supabaseUser.id,
        subscriptionTier: 'individual',
        agencyId: agency.id,
      },
    });
    return res.status(201).json(producer);
  }

  if (!tier) return res.status(400).json({ error: 'name and tier are required.' });
  if (!['individual', 'agency_owner'].includes(tier)) {
    return res.status(400).json({ error: 'tier must be "individual" or "agency_owner".' });
  }

  // Agency.ownerId is a real FK to Producer, so the producer has to exist before the
  // agency can reference it — create producer first, then agency, then link back.
  const producer = await prisma.$transaction(async (tx) => {
    let created = await tx.producer.create({
      data: {
        name,
        email: req.supabaseUser.email,
        supabaseUserId: req.supabaseUser.id,
        subscriptionTier: tier,
      },
    });
    if (tier === 'agency_owner') {
      const agency = await tx.agency.create({
        data: { name: agencyName || `${name}'s Agency`, ownerId: created.id },
      });
      created = await tx.producer.update({ where: { id: created.id }, data: { agencyId: agency.id } });
    }
    return created;
  });

  res.status(201).json(producer);
}));

module.exports = router;
