// Writes STRIPE_SECRET_KEY into .env.dev from a key you paste here, so it never has to be
// typed into a chat or hand-edited. Refuses anything that isn't a TEST key. Input is hidden.
const fs = require('fs');
const readline = require('readline');

const FILE = '.env.dev';
const text = fs.readFileSync(FILE, 'utf8');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
rl._writeToOutput = function (s) { if (s.includes('Stripe')) rl.output.write(s); };
rl.question('Paste your Stripe TEST secret key (sk_test_... — typing is hidden): ', (answer) => {
  rl.close();
  console.log('');
  const key = answer.trim();
  if (!/^(sk|rk)_test_[A-Za-z0-9]{20,}$/.test(key)) {
    console.error('That does not look like a Stripe TEST secret key (it must start with sk_test_). Nothing changed.');
    process.exit(1);
  }
  fs.writeFileSync(FILE, text.replace(/^STRIPE_SECRET_KEY=.*$/m, `STRIPE_SECRET_KEY="${key}"`));
  console.log(`Saved STRIPE_SECRET_KEY to ${FILE} (length ${key.length}, test mode).`);
});
