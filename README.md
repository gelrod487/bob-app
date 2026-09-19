# BOB — Book of Business

A Node/Express + Prisma/Postgres app implementing the schema, commission ledger rules,
payment reminders, CSV/XLSX import, real authentication (Supabase Auth), and subscription
billing (Stripe) described in `bob-schema.md`.

## What's here

```
prisma/schema.prisma        — the full data model, including auth/billing fields on Producer
src/lib/db.js                — Prisma client singleton
src/lib/supabase.js          — server-side Supabase client (secret key — verifies sessions)
src/lib/stripe.js            — Stripe client
src/lib/profitability.js     — the Net Profit formulas for both subscription tiers
src/middleware/auth.js       — verifies the Supabase session on every /api request
src/middleware/tier.js       — enforces the "staff/recruiting/override are agency-only" rule
src/routes/auth.js           — POST /api/auth/bootstrap (creates the Producer row after sign-up)
src/routes/me.js             — GET /api/me (current producer profile, used by the frontend)
src/routes/billing.js        — Stripe Checkout + Customer Portal session creation
src/routes/billingWebhook.js — Stripe webhook handler (keeps subscription status in sync)
src/routes/*.js              — CRUD endpoints for every entity
src/routes/import.js         — column-mapping + disposition-text-recovery import logic
src/server.js                — wires it all together
public/                      — the real frontend (login/signup, dashboard, billing, etc.)
```

## Getting started

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, Supabase keys, and Stripe keys
npx prisma migrate dev --name init
npm run dev             # starts the API + frontend on :4000
```

Then open `http://localhost:4000` in a browser — it'll route you to sign up or log in.

### Supabase notes
- Use the **Transaction pooler** connection string (Project Settings → Database), not the
  direct connection — the direct host is IPv6-only and won't resolve on most local networks.
- `SUPABASE_PUBLISHABLE_KEY` is safe to expose in the frontend (it's hardcoded into
  `public/js/supabaseClient.js`, same as an "anon" key in older Supabase projects).
  `SUPABASE_SECRET_KEY` must stay server-side only — it's used in `src/lib/supabase.js` to
  verify any user's session token.

### Stripe webhook setup (still a manual step)
The webhook handler (`src/routes/billingWebhook.js`) is implemented and wired up at
`POST /api/billing/webhook`, but Stripe needs to know where to send events, and `.env`
needs the signing secret it generates:

- **Local dev:** install the Stripe CLI, then run
  `stripe listen --forward-to localhost:4000/api/billing/webhook` — it prints a `whsec_...`
  value; put that in `STRIPE_WEBHOOK_SECRET`.
- **Production:** in the Stripe Dashboard, add a webhook endpoint pointing at
  `https://<your-domain>/api/billing/webhook`, subscribed to at least
  `checkout.session.completed`, `customer.subscription.updated`, and
  `customer.subscription.deleted`. Copy the signing secret it gives you into `.env`.

## How auth works

Sign-up/sign-in happens entirely client-side against Supabase Auth (`public/login.html`,
using the publishable key). Once Supabase returns a session, the frontend calls
`POST /api/auth/bootstrap` once to create the app's own `Producer` row (name, plan choice,
and — for Agency Owner — a new `Agency` row), linked by `supabaseUserId`. Every other
`/api` request carries `Authorization: Bearer <supabase access token>`; `src/middleware/auth.js`
verifies it against Supabase and attaches `req.producerId`, exactly like the old
`x-producer-id` shim did — route internals didn't need to change.

## How billing works

`public/app.html`'s Billing tab calls `POST /api/billing/checkout-session` with the chosen
plan, which creates a Stripe Customer (first time only) and a Checkout Session, then
redirects the browser to Stripe's hosted checkout page. After payment, Stripe calls the
webhook, which updates `Producer.subscriptionStatus` / `subscriptionTier` in the database.
"Manage Billing" opens Stripe's Customer Portal for self-serve cancellation/plan changes.

## What's deliberately NOT built yet

1. **File upload handling.** `POST /api/import/parse-workbook` (for XLSX specifically; CSV
   is handled fully client-side) still accepts a base64-encoded file in the JSON body.
   Swap for real multipart upload (`multer`) before handling large files.
2. **Tests.** None yet. `src/lib/profitability.js` is the highest-value place to start.
3. **Proration / plan changes.** Switching plans creates a fresh Checkout Session rather
   than updating an existing subscription in place — fine for a first subscription, but a
   real upgrade/downgrade flow should use `stripe.subscriptions.update` with proration
   instead of layering a second subscription on top.
4. **Supabase email confirmation UX.** If email confirmation is enabled on the Supabase
   project (Authentication → Providers → Email), a new signup won't get a session
   immediately — `public/login.html` handles this (shows a "check your email" message and
   finishes account setup on next sign-in), but there's no "resend confirmation" button yet.

## Design decisions worth knowing before you extend this

- **`commission_entry.owner_id`** from the SQL spec became two nullable foreign keys
  (`producerId` / `agencyId`) in the Prisma schema instead of one polymorphic column — Prisma
  doesn't support polymorphic relations cleanly, and this way the ORM can still do real joins.
  Same treatment for `expense`.
- **`annual_premium`** is not stored anywhere — it's a generated column in the SQL spec
  (`monthly_premium * 12`), and this scaffold just computes it inline wherever it's needed.
- **The two profitability functions in `src/lib/profitability.js` are the single source of
  truth for the Net Profit math.** Any report, dashboard widget, or export feature should call
  these rather than re-summing the ledger tables independently.
- **The frontend is plain HTML/CSS/JS served as static files** (no build step, no framework)
  to match the existing prototype and keep the stack simple. `public/js/api.js` is the one
  shared helper every page uses to call the backend with the current Supabase session token.

## Reference documents

- `bob-schema.md` — the full spec this was built from.
- `bob-prototype.html` — the original static mockup this frontend was built from.
