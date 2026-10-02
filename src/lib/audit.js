const prisma = require('./db');

// Records an admin action. adminEmail always comes from the verified Supabase session on
// the request, never from the request body, so an entry can't be attributed to someone
// else. Awaited by callers on purpose: if the audit write fails the request fails too,
// rather than silently leaving an admin change with no record.
async function logAdminAction(req, action, targetProducerId, detail) {
  await prisma.auditLog.create({
    data: {
      adminEmail: req.supabaseUser.email,
      action,
      targetProducerId: targetProducerId || null,
      detail: detail === undefined ? undefined : detail,
    },
  });
}

module.exports = { logAdminAction };
