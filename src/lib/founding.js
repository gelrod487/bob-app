const { isAdminEmail } = require('../middleware/auth');

// The "Founding 75" program: the first 75 agents to start a trial lock in 50% off every plan for as long
// as they stay subscribed. A member is a producer with a foundingNumber (1..75).
//
// The program only exists once a Stripe coupon is configured (FOUNDING_COUPON_ID — a 50%-off, "forever"
// coupon). Until then nobody is tagged, no counter shows, and checkout behaves exactly as before.
const PERCENT_OFF = 50;
const LOCK = 7531001; // arbitrary constant: serializes number handout so two signups can't take the same spot

function limit() { const n = parseInt(process.env.FOUNDING_LIMIT || '75', 10); return Number.isFinite(n) && n > 0 ? n : 75; }
function couponId() { return (process.env.FOUNDING_COUPON_ID || '').trim(); }
function enabled() { return !!couponId(); }

// Gives the producer the lowest free spot, if any are left. Returns their number, or null.
// (Lowest free, not "next", so a spot freed by an admin is handed out again.)
async function assignFoundingNumber(prisma, producerId) {
  if (!enabled()) return null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK})`;
        const me = await tx.producer.findUnique({ where: { id: producerId }, select: { foundingNumber: true } });
        if (!me) return null;
        if (me.foundingNumber) return me.foundingNumber;
        const used = new Set((await tx.producer.findMany({ where: { foundingNumber: { not: null } }, select: { foundingNumber: true } })).map((p) => p.foundingNumber));
        let next = null;
        for (let i = 1; i <= limit(); i++) if (!used.has(i)) { next = i; break; }
        if (next === null) return null;
        await tx.producer.update({ where: { id: producerId }, data: { foundingNumber: next } });
        return next;
      });
    } catch (err) {
      if (err.code === 'P2002' && attempt < 2) continue; // lost a race for the number; try again
      throw err;
    }
  }
  return null;
}

async function foundingStatus(prisma) {
  if (!enabled()) return { enabled: false, limit: limit(), taken: 0, remaining: 0 };
  const taken = await prisma.producer.count({ where: { foundingNumber: { not: null } } });
  return { enabled: true, limit: limit(), taken, remaining: Math.max(0, limit() - taken) };
}

// When the program is switched on, accounts that already exist (earlier testers) take the first spots,
// oldest first — except BOB's own team. Safe to run on every start: it only fills empty spots.
async function backfillFounding(prisma) {
  if (!enabled()) return 0;
  const status = await foundingStatus(prisma);
  if (status.remaining <= 0) return 0;
  const candidates = await prisma.producer.findMany({
    where: { foundingNumber: null, isComped: false }, orderBy: { createdAt: 'asc' }, select: { id: true, email: true },
  });
  let given = 0;
  for (const c of candidates) {
    if (isAdminEmail(c.email)) continue;
    if (await assignFoundingNumber(prisma, c.id) === null) break; // no spots left
    given++;
  }
  return given;
}

module.exports = { PERCENT_OFF, enabled, couponId, limit, assignFoundingNumber, foundingStatus, backfillFounding };
