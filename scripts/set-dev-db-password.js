// Rebuilds DATABASE_URL and DIRECT_URL in .env.dev from just the project ref + pooler host
// (taken from the existing DIRECT_URL) and a password you type here. Saves hand-editing two
// long connection strings. The password is never echoed or printed.
const fs = require('fs');
const readline = require('readline');

const FILE = '.env.dev';
const text = fs.readFileSync(FILE, 'utf8');
const direct = (text.match(/^DIRECT_URL="?([^"\n]+)"?/m) || [])[1];
if (!direct) { console.error('DIRECT_URL not found in .env.dev'); process.exit(1); }
const u = new URL(direct);
const ref = u.username.replace(/^postgres\./, '');
const host = u.hostname;
if (!host.endsWith('.pooler.supabase.com')) {
  console.error(`DIRECT_URL host is "${host}", not a Session pooler address (…pooler.supabase.com). Re-copy the Session pooler string first.`);
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
rl._writeToOutput = function (s) { if (s.includes('Database password')) rl.output.write(s); };
rl.question('Database password for the bob-dev project (typing is hidden): ', (answer) => {
  rl.close();
  console.log('');
  const password = answer.trim();
  if (!password) { console.error('No password entered; nothing changed.'); process.exit(1); }
  const enc = encodeURIComponent(password);
  const build = (port, query) => `postgresql://postgres.${ref}:${enc}@${host}:${port}/postgres${query}`;
  let out = text.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${build(6543, '?pgbouncer=true')}"`);
  out = out.replace(/^DIRECT_URL=.*$/m, `DIRECT_URL="${build(5432, '')}"`);
  fs.writeFileSync(FILE, out);
  console.log(`Updated DATABASE_URL (port 6543, pgbouncer) and DIRECT_URL (port 5432) for project ${ref}. Password length: ${password.length}.`);
});
