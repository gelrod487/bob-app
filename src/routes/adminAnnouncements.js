const express = require('express');
const prisma = require('../lib/db');
const asyncHandler = require('../middleware/asyncHandler');
const { logAdminAction } = require('../lib/audit');
const { httpError } = require('../lib/httpError');

// Mounted under /api/admin/announcements (already behind requireAdmin).
const router = express.Router();
const LEVELS = ['info', 'warning'];

function parseDate(value, label) {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw httpError(400, `${label} must be a valid date.`);
  return d;
}

function readFields(body, { partial }) {
  const data = {};
  if (!partial || body.message !== undefined) {
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) throw httpError(400, 'A message is required.');
    if (message.length > 500) throw httpError(400, 'Keep the message under 500 characters.');
    data.message = message;
  }
  if (body.level !== undefined) {
    if (!LEVELS.includes(body.level)) throw httpError(400, `level must be one of: ${LEVELS.join(', ')}`);
    data.level = body.level;
  }
  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') throw httpError(400, 'active must be true or false.');
    data.active = body.active;
  }
  if (body.startsAt !== undefined) data.startsAt = parseDate(body.startsAt, 'startsAt');
  if (body.endsAt !== undefined) data.endsAt = parseDate(body.endsAt, 'endsAt');
  if (data.startsAt && data.endsAt && data.endsAt <= data.startsAt) throw httpError(400, 'The end time must be after the start time.');
  return data;
}

router.get('/', asyncHandler(async (req, res) => {
  res.json(await prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } }));
}));

router.post('/', asyncHandler(async (req, res) => {
  const created = await prisma.announcement.create({ data: readFields(req.body, { partial: false }) });
  await logAdminAction(req, 'announcement.create', null, { id: created.id, message: created.message, level: created.level });
  res.status(201).json(created);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const existing = await prisma.announcement.findUnique({ where: { id: req.params.id } });
  if (!existing) throw httpError(404, 'Announcement not found.');
  const data = readFields(req.body, { partial: true });
  if (!Object.keys(data).length) throw httpError(400, 'Nothing to update.');
  const updated = await prisma.announcement.update({ where: { id: existing.id }, data });
  await logAdminAction(req, 'announcement.update', null, { id: existing.id, changed: Object.keys(data) });
  res.json(updated);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const existing = await prisma.announcement.findUnique({ where: { id: req.params.id } });
  if (!existing) throw httpError(404, 'Announcement not found.');
  await prisma.announcement.delete({ where: { id: existing.id } });
  await logAdminAction(req, 'announcement.delete', null, { id: existing.id, message: existing.message });
  res.json({ ok: true });
}));

module.exports = router;
