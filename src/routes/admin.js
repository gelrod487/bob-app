const express = require('express');
const prisma = require('../lib/db');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// GET /api/admin/producers — every subscriber, for the internal admin dashboard.
// Gated by requireAdmin in server.js, not by tier/subscription — this is BOB's own
// team looking at its customers, not a customer-facing feature.
router.get('/producers', asyncHandler(async (req, res) => {
  const producers = await prisma.producer.findMany({
    include: { agency: true, _count: { select: { clients: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(producers.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    agencyName: p.agency?.name || null,
    subscriptionTier: p.subscriptionTier,
    subscriptionStatus: p.subscriptionStatus,
    clientCount: p._count.clients,
    createdAt: p.createdAt,
  })));
}));

module.exports = router;
