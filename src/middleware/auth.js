const supabaseAdmin = require('../lib/supabase');
const prisma = require('../lib/db');
const asyncHandler = require('./asyncHandler');

// Verifies the Supabase access token on every /api request and, if a Producer row already
// exists for that Supabase user, attaches it. Routes that need an existing Producer (i.e.
// everything except POST /api/auth/bootstrap) should also apply requireProducer below.
async function requireAuth(req, res, next) {
  const header = req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing bearer token.' });

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ error: 'Invalid or expired session.' });

  req.supabaseUser = data.user;
  const producer = await prisma.producer.findUnique({ where: { supabaseUserId: data.user.id } });
  req.producer = producer;
  req.producerId = producer ? producer.id : null;
  next();
}

// Apply after requireAuth on any route that needs req.producerId to already be set —
// without this, a Prisma `where: { producerId: undefined }` would silently match every
// producer's rows instead of failing closed.
function requireProducer(req, res, next) {
  if (!req.producerId) {
    return res.status(409).json({ error: 'Finish setting up your account first (POST /api/auth/bootstrap).' });
  }
  next();
}

module.exports = { requireAuth: asyncHandler(requireAuth), requireProducer };
