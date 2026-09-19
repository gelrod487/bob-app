const express = require('express');
const prisma = require('../lib/db');

const router = express.Router();

// POST /api/auth/bootstrap — called once, right after Supabase sign-up (or first sign-in),
// to create the app-level Producer row for a Supabase Auth user. Safe to call again for an
// already-bootstrapped user: it just returns the existing Producer.
router.post('/bootstrap', async (req, res) => {
  const existing = await prisma.producer.findUnique({ where: { supabaseUserId: req.supabaseUser.id } });
  if (existing) return res.json(existing);

  const { name, tier, agencyName } = req.body;
  if (!name || !tier) return res.status(400).json({ error: 'name and tier are required.' });
  if (!['individual', 'agency_owner'].includes(tier)) {
    return res.status(400).json({ error: 'tier must be "individual" or "agency_owner".' });
  }

  const producer = await prisma.$transaction(async (tx) => {
    let agencyId = null;
    if (tier === 'agency_owner') {
      const agency = await tx.agency.create({ data: { name: agencyName || `${name}'s Agency` } });
      agencyId = agency.id;
    }
    return tx.producer.create({
      data: {
        name,
        email: req.supabaseUser.email,
        supabaseUserId: req.supabaseUser.id,
        subscriptionTier: tier,
        agencyId,
      },
    });
  });

  res.status(201).json(producer);
});

module.exports = router;
