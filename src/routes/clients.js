const express = require('express');
const prisma = require('../lib/db');

const router = express.Router();

// GET /api/clients — every client belonging to the authenticated producer
router.get('/', async (req, res) => {
  const clients = await prisma.client.findMany({
    where: { producerId: req.producerId },
    include: { policies: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(clients);
});

// POST /api/clients
router.post('/', async (req, res) => {
  const { name, phone, email } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required.' });

  const client = await prisma.client.create({
    data: {
      producerId: req.producerId,
      name,
      contactInfo: { phone: phone || null, email: email || null },
    },
  });
  res.status(201).json(client);
});

module.exports = router;
