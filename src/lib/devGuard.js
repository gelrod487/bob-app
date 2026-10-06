// Safety net for local development. Local runs must use the separate dev Supabase project
// (see .env.dev.example) — never production, whose database and auth users are real
// customers'. The production project's ref is public (it's in public/js/supabaseClient.js).
const PRODUCTION_PROJECT_REF = 'ypufernbsvfodrqelymc';
const REQUIRED = ['DATABASE_URL', 'DIRECT_URL', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY'];

// Returns a list of problems; empty means the environment is safe to run locally.
function devEnvProblems(env = process.env) {
  const problems = [];
  for (const key of REQUIRED) {
    if (!env[key]) problems.push(`${key} is missing from the dev env file.`);
  }
  for (const key of ['DATABASE_URL', 'DIRECT_URL', 'SUPABASE_URL']) {
    if ((env[key] || '').includes(PRODUCTION_PROJECT_REF)) {
      problems.push(`${key} points at the PRODUCTION Supabase project (${PRODUCTION_PROJECT_REF}).`);
    }
  }
  const stripeKey = (env.STRIPE_SECRET_KEY || '').trim();
  if (stripeKey.startsWith('sk_live_') || stripeKey.startsWith('rk_live_')) {
    problems.push('STRIPE_SECRET_KEY is a LIVE Stripe key — use an sk_test_ key locally.');
  }
  return problems;
}

function assertDevEnv(env = process.env) {
  const problems = devEnvProblems(env);
  if (problems.length) {
    console.error('\nRefusing to run: this does not look like a safe dev environment.\n - ' + problems.join('\n - ') +
      '\n\nSee .env.dev.example for how to set up the separate dev project.\n');
    process.exit(1);
  }
}

module.exports = { assertDevEnv, devEnvProblems };
