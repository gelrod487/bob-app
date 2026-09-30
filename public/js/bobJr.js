// Bob Jr — a small, no-AI help widget. Matches whatever's typed against a fixed list of
// BOB how-to questions by keyword overlap and shows the closest answer. Deliberately not
// an LLM: no API key, no per-message cost, and it can never answer anything outside this
// list, which is exactly the point for "how do I use this app" questions.

const BOB_JR_FAQ = [
  {
    q: "How do I add a new client or case?",
    keywords: ['add', 'new', 'client', 'case', 'create'],
    a: "Go to the Book tab and click \"+ Add client\" (there's also an \"+ Add a client\" shortcut on the Desk tab). Fill in the carrier, product, premium, and status — Policy Number, Coverage Amount, and dates are optional and can be filled in later from the case's detail view.",
  },
  {
    q: "How do I edit or delete a client's case?",
    keywords: ['edit', 'delete', 'remove', 'change', 'update', 'case', 'client'],
    a: "Click any client's name on the Desk or Book tab to open their case detail. You can edit every field there and save your changes, or use \"Delete case\" at the bottom to remove it entirely.",
  },
  {
    q: "What's the difference between Monthly Premium and Single Premium?",
    keywords: ['single premium', 'monthly premium', 'sale type', 'annuity'],
    a: "Set the case's Sale Type to \"Life\" and you'll get a Monthly Premium field (BOB annualizes it automatically for reporting). Set it to \"Annuity\" and the form switches to a Single Premium field instead, since annuities are usually one lump-sum deposit rather than a recurring premium.",
  },
  {
    q: "How do I log a commission payment on a case?",
    keywords: ['log', 'commission', 'payment', 'paid', 'advance', 'chargeback', 'installment'],
    a: "Open the case from Desk or Book, scroll to \"Commission entries\" right there in the detail view, pick a Type (Initial, Installment, Renewal, Chargeback, or Override for Agency Owners), enter the amount and date, and click \"Log Commission\". No need to go to the Profit tab separately.",
  },
  {
    q: "How do I import my book from a spreadsheet?",
    keywords: ['import', 'spreadsheet', 'csv', 'excel', 'upload', 'bulk'],
    a: "On the Book tab, click \"Show\" next to \"Import from a spreadsheet\", then drop in a CSV or Excel file. BOB guesses which column is which (client name, carrier, premium, etc.) and lets you fix any mapping before anything is actually added — nothing imports until you confirm.",
  },
  {
    q: "How does the Commission Calculator work?",
    keywords: ['calculator', 'commission calculator', 'rates', 'payout', 'contract level'],
    a: "The Commission Calculator (Producer Plus and Agency Owner plans) shows payout rates by carrier and product, based on your IMO and contract level. You have to set your IMO name and contract level (or Annuity Tier) on the Settings page first, or the calculator won't have anything to show.",
  },
  {
    q: "How do I set up my IMO and contract level?",
    keywords: ['imo', 'upline', 'contract level', 'annuity tier', 'settings'],
    a: "Go to Settings → \"IMO & contract level\". Start typing your IMO's name — if it's already on BOB you'll see it in the list, which means you'll share the same commission-rate data others on that IMO have already entered. Set your Contract Level (%) for life products and your Annuity Tier for annuities.",
  },
  {
    q: "How do I invite an agent to my agency?",
    keywords: ['invite', 'agent', 'agency', 'team', 'producer', 'downline'],
    a: "Agency Owner plan only: go to the Team tab and copy the invite link there. Anyone who signs up through it automatically reports into your agency — they still get their own 14-day trial and their own Producer subscription afterward, it just decides whose dashboard their numbers roll up into.",
  },
  {
    q: "How do I set monthly goals?",
    keywords: ['goals', 'target', 'monthly goal', 'dials target', 'sales target'],
    a: "The Goals tab lets you set targets for dials, appointments, sits, sales, and FYC — these drive the progress bars on your Desk. Agency Owners also get a separate Team Goals section for agency-wide targets.",
  },
  {
    q: "What is my trial period, and what happens when it ends?",
    keywords: ['trial', '14-day', '14 day', 'subscribe', 'subscription', 'expire', 'billing'],
    a: "Every new account gets a 14-day free trial. Once it ends, you'll be routed to the Subscribe tab to pick a plan — Producer ($29/mo), Producer Plus ($39/mo, adds the Commission Calculator), or Agency Owner ($79/mo, adds the Team tab). Your data is never deleted, you just can't use the app again until you subscribe.",
  },
  {
    q: "How do I submit feedback or request a feature?",
    keywords: ['feedback', 'suggestion', 'feature request', 'bug', 'report'],
    a: "Click the Feedback tab in the sidebar and send your message — it goes straight to BOB's team. You can check back on that same page to see the status of anything you've submitted.",
  },
  {
    q: "How do I turn on two-factor authentication (2FA)?",
    keywords: ['2fa', 'two-factor', 'two factor', 'mfa', 'authenticator', 'security'],
    a: "Go to Settings → \"Two-Factor Authentication\" → \"Enable 2FA\". Scan the QR code with an authenticator app (like Google Authenticator or Authy), enter the 6-digit code it shows you, and you're set — you'll be asked for a fresh code each time you sign in from then on.",
  },
  {
    q: "How do I reset my password?",
    keywords: ['reset', 'forgot', 'password', 'login', 'sign in'],
    a: "On the sign-in page, click \"Forgot password?\", enter your email, and you'll get a reset link. If you're already signed in, there's currently no in-app \"change password\" option — use the same forgot-password link.",
  },
  {
    q: "What's a chargeback, and how does it affect my numbers?",
    keywords: ['chargeback', 'clawback', 'lapsed'],
    a: "A chargeback happens when a paid case lapses or gets cancelled and the carrier claws back the commission. Logging a Chargeback entry on that case subtracts it from your Gross Commission and shows it separately on the Desk and Profit tab so it's never hidden inside your other numbers.",
  },
  {
    q: "How is Net Profit calculated?",
    keywords: ['net profit', 'profit', 'formula', 'calculate'],
    a: "Net Profit = Gross Commission − Chargebacks − your logged Expenses, over whatever date range you've selected. Gross Commission is the sum of every commission entry you've logged (Initial, Installment, Renewal, Override) excluding chargebacks.",
  },
  {
    q: "What is Persistency?",
    keywords: ['persistency', 'percentage', 'lapse rate'],
    a: "Persistency is the percentage of your placed cases (issued 12+ months ago) that are still active rather than lapsed. It's one of the stat cards on the Book tab.",
  },
  {
    q: "How do I log my daily activity (dials, appointments, etc.)?",
    keywords: ['activity', 'dials', 'appointments', 'presentations', 'sales', 'log activity'],
    a: "The Desk tab has quick +/− counters for Dials, Appointments, Presentations, and Sales for today — just click to log them as you go. The Activity tab shows your history and funnel conversion over any date range.",
  },
  {
    q: "What's the difference between the Producer, Producer Plus, and Agency Owner plans?",
    keywords: ['plan', 'pricing', 'producer plus', 'agency owner', 'tier', 'difference'],
    a: "Producer ($29/mo) is the core book-of-business tracker. Producer Plus ($39/mo) adds the Commission Calculator. Agency Owner ($79/mo) adds the Team tab so you can invite agents and see rolled-up agency numbers, on top of everything Producer Plus includes.",
  },
  {
    q: "How do I log costs or expenses?",
    keywords: ['costs', 'expenses', 'lead cost', 'overhead'],
    a: "The Costs tab is where you log recurring or one-time expenses (lead costs, tools, etc.) — these are what get subtracted from Gross Commission to get your Net Profit.",
  },
];

// Excluded from the question-text overlap pass below — these appear in nearly every
// FAQ question ("What's...", "How do I...") and would otherwise match almost anything.
const BOB_JR_STOPWORDS = new Set([
  'what', 'whats', 'how', 'why', 'when', 'where', 'who', 'the', 'and', 'for', 'are', 'you',
  'does', 'do', 'did', 'can', 'could', 'should', 'would', 'with', 'from', 'into', 'this',
  'that', 'have', 'has', 'get', 'set', 'set up', 'work', 'works', 'use', 'my', 'me', 'it',
]);

function bobJrScore(input, entry) {
  const lowerInput = input.toLowerCase();
  const words = lowerInput.split(/\W+/).filter((w) => w.length > 2 && !BOB_JR_STOPWORDS.has(w));
  let score = 0;
  for (const kw of entry.keywords) {
    if (lowerInput.includes(kw)) score += 3;
  }
  const qWords = entry.q.toLowerCase().split(/\W+/).filter((w) => w.length > 2 && !BOB_JR_STOPWORDS.has(w));
  for (const w of words) {
    if (qWords.includes(w)) score += 1;
  }
  return score;
}

function bobJrBestMatch(input) {
  if (!input.trim()) return null;
  let best = null;
  let bestScore = 0;
  for (const entry of BOB_JR_FAQ) {
    const score = bobJrScore(input, entry);
    if (score > bestScore) { bestScore = score; best = entry; }
  }
  return bestScore >= 3 ? best : null;
}

function initBobJr() {
  const root = document.createElement('div');
  root.innerHTML = `
    <button id="bobJrToggle" class="bobjr-toggle" aria-label="Open Bob Jr help chat">
      <img src="/img/bob-mascot.png" alt="">
    </button>
    <div id="bobJrPanel" class="bobjr-panel section-hidden">
      <div class="bobjr-header">
        <div><strong>Bob Jr</strong><div class="bobjr-subtitle">Quick answers about using BOB</div></div>
        <button id="bobJrClose" class="bobjr-close" aria-label="Close">×</button>
      </div>
      <div id="bobJrMessages" class="bobjr-messages"></div>
      <div id="bobJrChips" class="bobjr-chips"></div>
      <form id="bobJrForm" class="bobjr-form">
        <input id="bobJrInput" type="text" placeholder="Ask a question…" autocomplete="off">
        <button type="submit" class="primary">Ask</button>
      </form>
    </div>
  `;
  document.body.appendChild(root);

  const toggle = document.getElementById('bobJrToggle');
  const panel = document.getElementById('bobJrPanel');
  const messages = document.getElementById('bobJrMessages');
  const chips = document.getElementById('bobJrChips');
  const form = document.getElementById('bobJrForm');
  const input = document.getElementById('bobJrInput');

  function addMessage(text, who) {
    const div = document.createElement('div');
    div.className = `bobjr-msg bobjr-msg-${who}`;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function renderChips() {
    const sample = BOB_JR_FAQ.slice(0, 5);
    chips.innerHTML = sample.map((e, i) => `<button type="button" class="bobjr-chip" data-i="${BOB_JR_FAQ.indexOf(e)}">${e.q}</button>`).join('');
    chips.querySelectorAll('.bobjr-chip').forEach((btn) => {
      btn.onclick = () => askQuestion(BOB_JR_FAQ[Number(btn.dataset.i)].q);
    });
  }

  function askQuestion(text) {
    addMessage(text, 'user');
    const match = bobJrBestMatch(text);
    if (match) {
      addMessage(match.a, 'bot');
    } else {
      addMessage("I don't have an answer for that one yet — try rephrasing, or send it through the Feedback tab and BOB's team will take a look.", 'bot');
    }
  }

  toggle.onclick = () => {
    const opening = panel.classList.contains('section-hidden');
    panel.classList.toggle('section-hidden');
    if (opening && !messages.dataset.greeted) {
      messages.dataset.greeted = '1';
      addMessage("Hi, I'm Bob Jr! Ask me how to do something in BOB, or tap a question below.", 'bot');
      renderChips();
    }
  };
  document.getElementById('bobJrClose').onclick = () => panel.classList.add('section-hidden');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    askQuestion(text);
  });
}

document.addEventListener('DOMContentLoaded', initBobJr);
