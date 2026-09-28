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

const VALID_STATUSES = ['open', 'planned', 'done', 'declined'];

// GET /api/admin/suggestions — every producer's feedback, newest first.
router.get('/suggestions', asyncHandler(async (req, res) => {
  const suggestions = await prisma.suggestion.findMany({
    include: { producer: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(suggestions.map((s) => ({
    id: s.id,
    message: s.message,
    status: s.status,
    createdAt: s.createdAt,
    producerName: s.producer.name,
    producerEmail: s.producer.email,
  })));
}));

// PUT /api/admin/suggestions/:id — status triage only (open/planned/done/declined).
router.put('/suggestions/:id', asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  const updated = await prisma.suggestion.update({ where: { id: req.params.id }, data: { status } });
  res.json(updated);
}));

module.exports = router;
