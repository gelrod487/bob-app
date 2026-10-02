const express = require('express');
const prisma = require('../lib/db');
const asyncHandler = require('../middleware/asyncHandler');
const { logAdminAction } = require('../lib/audit');
const { httpError } = require('../lib/httpError');

// Mounted under /api/admin/flags (already behind requireAdmin). The allowlist is typed as
// emails in the console and stored as producer ids.
const router = express.Router();
const KEY_PATTERN = /^[a-z][a-z0-9_]{1,48}$/;

async function emailsToIds(emails) {
  if (emails === undefined) return undefined;
  if (!Array.isArray(emails)) throw httpError(400, 'allowlistEmails must be a list of emails.');
  const cleaned = [...new Set(emails.map((e) => String(e).trim().toLowerCase()).filter(Boolean))];
  if (!cleaned.length) return [];
  const found = await prisma.producer.findMany({ where: { email: { in: cleaned, mode: 'insensitive' } }, select: { id: true, email: true } });
  const foundEmails = new Set(found.map((p) => p.email.toLowerCase()));
  const missing = cleaned.filter((e) => !foundEmails.has(e));
  if (missing.length) throw httpError(400, `No customer found for: ${missing.join(', ')}`);
  return found.map((p) => p.id);
}

async function present(flags) {
  const ids = [...new Set(flags.flatMap((f) => f.allowlist))];
  const producers = ids.length ? await prisma.producer.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } }) : [];
  const byId = new Map(producers.map((p) => [p.id, p]));
  return flags.map((f) => ({
    id: f.id, key: f.key, description: f.description, enabled: f.enabled, createdAt: f.createdAt,
    allowlist: f.allowlist.map((id) => byId.get(id) || { id, name: '(deleted account)', email: null }),
  }));
}

router.get('/', asyncHandler(async (req, res) => {
  res.json(await present(await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } })));
}));

router.post('/', asyncHandler(async (req, res) => {
  const key = String(req.body.key || '').trim();
  if (!KEY_PATTERN.test(key)) throw httpError(400, 'A flag key is lowercase letters, numbers and underscores, starting with a letter (e.g. new_dashboard).');
  if (await prisma.featureFlag.findUnique({ where: { key } })) throw httpError(409, `A flag named "${key}" already exists.`);
  const allowlist = (await emailsToIds(req.body.allowlistEmails)) || [];
  const created = await prisma.featureFlag.create({
    data: { key, description: req.body.description ? String(req.body.description).slice(0, 300) : null, enabled: req.body.enabled === true, allowlist },
  });
  await logAdminAction(req, 'flag.create', null, { key, enabled: created.enabled, allowlistCount: allowlist.length });
  res.status(201).json((await present([created]))[0]);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const existing = await prisma.featureFlag.findUnique({ where: { id: req.params.id } });
  if (!existing) throw httpError(404, 'Flag not found.');
  const data = {};
  if (req.body.enabled !== undefined) {
    if (typeof req.body.enabled !== 'boolean') throw httpError(400, 'enabled must be true or false.');
    data.enabled = req.body.enabled;
  }
  if (req.body.description !== undefined) data.description = req.body.description ? String(req.body.description).slice(0, 300) : null;
  const allowlist = await emailsToIds(req.body.allowlistEmails);
  if (allowlist !== undefined) data.allowlist = allowlist;
  if (!Object.keys(data).length) throw httpError(400, 'Nothing to update.');
  const updated = await prisma.featureFlag.update({ where: { id: existing.id }, data });
  await logAdminAction(req, 'flag.update', null, { key: existing.key, changed: Object.keys(data), enabled: updated.enabled, allowlistCount: updated.allowlist.length });
  res.json((await present([updated]))[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const existing = await prisma.featureFlag.findUnique({ where: { id: req.params.id } });
  if (!existing) throw httpError(404, 'Flag not found.');
  await prisma.featureFlag.delete({ where: { id: existing.id } });
  await logAdminAction(req, 'flag.delete', null, { key: existing.key });
  res.json({ ok: true });
}));

module.exports = router;
