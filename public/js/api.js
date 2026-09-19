// Thin wrapper around fetch() that attaches the current Supabase session's access token.
// Every backend route under /api requires this — see src/middleware/auth.js.
async function apiFetch(path, { method = 'GET', body } = {}) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = '/login.html';
    throw new Error('No active session.');
  }

  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    window.location.href = '/login.html';
    throw new Error('Session expired.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
