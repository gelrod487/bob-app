const express = require('express');
const prisma = require('../lib/db');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// GET /api/suggestions — the caller's OWN submissions only (with status), so they can
// see what happened to something they sent in. Not visible to other producers — see the
// doc comment on the Suggestion model for why this is private, not a public forum.
router.get('/', asyncHandler(async (req, res) => {
  const suggestions = await prisma.suggestion.findMany({
    where: { producerId: req.producerId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(suggestions);
}));

// POST /api/suggestions
router.post('/', asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'message is required.' });
  }
  const suggestion = await prisma.suggestion.create({
    data: { producerId: req.producerId, message: message.trim() },
  });
  res.status(201).json(suggestion);
}));

module.exports = router;
