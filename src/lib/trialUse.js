const crypto = require('crypto');
const { isDisposableDomain } = require('../../public/js/disposableDomains.js');

// The free trial is one per person, not one per account. These helpers recognise the same
// person across the usual tricks, so a new login doesn't reset the clock:
//  - canonicalEmail: jane+1@x.com, jane+2@x.com and (for Gmail) j.ane@gmail.com are one mailbox.
//  - isDisposableEmail: throwaway-inbox services are refused at account setup.
//  - registerTrialUse: remembers a one-way fingerprint of every email that ever started a trial,
//    even after the account is deleted, and says whether this is the first time.
function canonicalEmail(email) {
  const raw = String(email || '').trim().toLowerCase();
  const at = raw.lastIndexOf('@');
  if (at < 1) return raw;
  let local = raw.slice(0, at);
  let domain = raw.slice(at + 1);
  const withoutTag = local.split('+')[0];
  if (withoutTag) local = withoutTag;
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replace(/\./g, '') || local;
  return `${local}@${domain}`;
}

function isDisposableEmail(email) {
  const at = String(email || '').lastIndexOf('@');
  return at > 0 && isDisposableDomain(String(email).slice(at + 1));
}

// One-way, so the table doesn't hold a readable list of every address that ever signed up.
function emailHash(email) {
  return crypto.createHash('sha256').update(`bob-trial-v1:${canonicalEmail(email)}`).digest('hex');
}

// Returns true when this is the first trial for this person, false when it was already used.
// createMany + skipDuplicates makes "claim it" a single atomic step, so two simultaneous
// signups can't both think they're first.
async function registerTrialUse(prisma, email) {
  const res = await prisma.trialUse.createMany({ data: [{ emailHash: emailHash(email) }], skipDuplicates: true });
  return res.count === 1;
}

// Existing accounts already used their trial. Fill in any that aren't recorded yet (safe to
// repeat; skipDuplicates). Runs at server start so the first deploy covers everyone already here.
async function backfillTrialUse(prisma) {
  const [have, producers] = await Promise.all([prisma.trialUse.count(), prisma.producer.findMany({ select: { email: true } })]);
  if (have >= producers.length) return 0;
  const hashes = [...new Set(producers.map((p) => emailHash(p.email)))];
  const res = await prisma.trialUse.createMany({ data: hashes.map((emailHash) => ({ emailHash })), skipDuplicates: true });
  return res.count;
}

module.exports = { canonicalEmail, isDisposableEmail, emailHash, registerTrialUse, backfillTrialUse };
