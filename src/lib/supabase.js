const { createClient } = require('@supabase/supabase-js');

// Server-side client, authenticated with the secret (service-role) key. This can verify
// any user's access token and must never be sent to the frontend — the frontend gets its
// own client built with the publishable key instead (see public/js/supabaseClient.js).
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

module.exports = supabaseAdmin;
