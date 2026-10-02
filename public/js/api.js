// Thin wrapper around fetch() that attaches the current Supabase session's access token.
// Every backend route under /api requires this — see src/middleware/auth.js.
async function apiFetch(path, { method = 'GET', body } = {}) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    if (!location.pathname.endsWith('/login.html')) window.location.href = '/login.html';
    throw new Error('No active session.');
  }

  // Set only in a tab opened from the admin console's "View as user" (sessionStorage is
  // per-tab, so the admin's other tabs are unaffected). The server honors it for admin
  // accounts only and refuses every non-GET request while it's present.
  let supportAs = null;
  try { supportAs = sessionStorage.getItem('supportAs'); } catch (e) { /* storage blocked */ }

  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...(supportAs ? { 'X-Support-Producer-Id': supportAs } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    const data = await res.json().catch(() => ({}));
    if (data.mfaRequired) {
      // The session itself is still valid — it just hasn't completed the account's 2FA
      // challenge yet (aal1, not aal2). Don't sign out; send them back to the login page,
      // which prompts for the authenticator code and then returns here.
      if (!location.pathname.endsWith('/login.html')) window.location.href = '/login.html';
      throw new Error('Additional verification required.');
    }
    // The Supabase session in localStorage is stale (e.g. the user was deleted, or the
    // token can't be verified server-side) — clear it so we don't loop redirecting back
    // to a page that still finds a "valid" local session.
    await supabaseClient.auth.signOut();
    if (!location.pathname.endsWith('/login.html')) window.location.href = '/login.html';
    throw new Error('Session expired.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
