// Sends transactional email through Resend's HTTP API (the same Resend account that already sends the
// sign-up / password-reset emails via Supabase). Needs RESEND_API_KEY. With no key set it does not
// send: the email is logged and kept in `outbox` (used by tests), so local dev can't email real people.
const outbox = [];

function apiKey() { return (process.env.RESEND_API_KEY || '').trim(); }
function from() { return (process.env.MAIL_FROM || 'BOB Support <support@getbob.agency>').trim(); }
function replyTo() { return (process.env.MAIL_REPLY_TO || 'support@getbob.agency').trim(); }
function configured() { return !!apiKey(); }

// Returns { sent: true, id } or { sent: false, skipped: true }. Throws on a real delivery failure so the
// caller can decide whether to retry.
async function sendMail({ to, subject, html, text }) {
  if (!configured()) {
    outbox.push({ to, subject, html, text, at: new Date() });
    if (outbox.length > 50) outbox.shift();
    console.log(`[mail] RESEND_API_KEY not set — not sending "${subject}" to ${to}`);
    return { sent: false, skipped: true };
  }
  const res = await fetch((process.env.RESEND_API_URL || 'https://api.resend.com/emails').trim(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: from(), to: [to], reply_to: replyTo(), subject, html, text }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json().catch(() => ({}));
  return { sent: true, id: data.id || null };
}

module.exports = { sendMail, configured, outbox };
