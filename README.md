# BOB — Book of Business (backend scaffold)

This is a working starting point for the real build, generated directly from `bob-schema.md`
(v6 — final) and the `bob-prototype.html` mockup. It's a Node/Express + Prisma/Postgres API
that implements the schema, the commission ledger rules, payment reminders, and the CSV/XLSX
importer's mapping logic. **It is not production-ready** — see the TODO list below for exactly
what's missing before this can go live.

## What's here

```
prisma/schema.prisma       — the full data model (agency, producer, client, policy,
                              commission_entry, payment_reminder, expense, owner_draw)
src/lib/db.js               — Prisma client singleton
src/lib/profitability.js    — the Net Profit formulas for both subscription tiers
src/middleware/tier.js      — enforces the "staff/recruiting/override are agency-only" rule
src/routes/*.js             — CRUD endpoints for every entity
src/routes/import.js        — column-mapping + disposition-text-recovery import logic
src/server.js               — wires it all together
```

## Getting started

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL at minimum
npm run prisma:migrate      # creates the tables in your Postgres database
npm run dev                 # starts the API on :4000
```

Every request currently requires an `x-producer-id` header (see "Auth" below for why, and
what to do about it). Quick manual test once a producer row exists:

```bash
curl http://localhost:4000/api/dashboard -H "x-producer-id: <a real producer id>"
```

## What's deliberately NOT built yet

This scaffold proves out the data model and business logic; it intentionally stops short of
everything that makes an app shippable. In priority order:

1. **Auth.** There's no real login. The `x-producer-id` header in `src/server.js` is a
   placeholder to make the rest of the routes testable. Replace it with real session or JWT
   auth (NextAuth, Clerk, or a hand-rolled JWT flow all work) — every route already reads
   `req.producerId`, so swapping the auth layer shouldn't require touching route logic.
2. **Stripe billing.** `.env.example` has placeholders for the two price IDs
   (`STRIPE_PRICE_ID_INDIVIDUAL` / `STRIPE_PRICE_ID_AGENCY`) but there's no checkout flow,
   webhook handler, or subscription-status sync yet. This is what actually gates a producer's
   `subscriptionTier` field in the database — right now that field is set manually.
3. **Frontend.** `bob-prototype.html` is a static mockup with fake data and browser-only
   storage. The real frontend needs to be built against these API routes — probably worth
   rebuilding as a proper React/Next.js app rather than continuing to extend a single HTML file.
4. **File upload handling.** `POST /api/import/parse-workbook` accepts a base64-encoded file
   in the JSON body as a quick way to prove out the XLSX-parsing logic. Swap this for real
   multipart file upload (`multer` or equivalent) before shipping — base64-in-JSON doesn't
   scale well past small files.
5. **Client-side mapping preview UI.** The importer's `/suggest-mapping` and `/commit`
   endpoints assume the frontend renders the editable mapping-confirmation screen described
   in `bob-schema.md` (the dropdowns-plus-preview-rows step) between them. That UI doesn't
   exist yet — the prototype's import tab is closest, but it isn't wired to a real backend.
6. **Tests.** None yet. `src/lib/profitability.js` is the highest-value place to start, since
   it's the calculation every dashboard number depends on.

## Design decisions worth knowing before you extend this

- **`commission_entry.owner_id`** from the SQL spec became two nullable foreign keys
  (`producerId` / `agencyId`) in the Prisma schema instead of one polymorphic column — Prisma
  doesn't support polymorphic relations cleanly, and this way the ORM can still do real joins.
  Same treatment for `expense`.
- **`annual_premium`** is not stored anywhere — it's a generated column in the SQL spec
  (`monthly_premium * 12`), and this scaffold just computes it inline wherever it's needed
  rather than adding a computed field to Prisma (which has weaker support for generated
  columns than raw SQL does). If you want it queryable/sortable at the database level, add
  it back as a raw SQL generated column via a Prisma migration.
- **The two profitability functions in `src/lib/profitability.js` are the single source of
  truth for the Net Profit math.** Any report, dashboard widget, or export feature should call
  these rather than re-summing the ledger tables independently — that's exactly the kind of
  duplicated logic that drifts out of sync over time.

## Reference documents

- `bob-schema.md` — the full spec this was built from: schema rationale, commission rules,
  payment reminder logic, and the import-mapping edge cases found in a real tracker file.
- `bob-prototype.html` — the visual/interaction reference for the frontend rebuild.
