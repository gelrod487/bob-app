const express = require('express');
const prisma = require('../lib/db');

const router = express.Router();

// GET /api/me — the frontend's one-call source of truth for "who is logged in, what plan
// are they on, do they still need to finish sign-up." Deliberately does NOT use
// requireProducer, since a null producer (not-yet-bootstrapped) is a valid, expected state.
router.get('/', async (req, res) => {
  if (!req.producerId) return res.json({ producer: null });

  const producer = await prisma.producer.findUnique({ where: { id: req.producerId } });
  res.json({
    producer: {
      id: producer.id,
      name: producer.name,
      email: producer.email,
      agencyId: producer.agencyId,
      subscriptionTier: producer.subscriptionTier,
      subscriptionStatus: producer.subscriptionStatus,
    },
  });
});

module.exports = router;
