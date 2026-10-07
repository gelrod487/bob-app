# Follow-ups

Running list of deferred action items — things that are deliberate "not now" decisions, not bugs.

## Security

- [ ] **Enable Point-in-Time Recovery (PITR) in Supabase** once the tester phase launches
      (~12 users) — Gustin's plan as of 2026-10-01. Currently relying on Supabase's free
      daily backups only, which can lose up to a day of data if something goes wrong. PITR
      lets you restore to any exact minute instead, at a cost (Pro plan add-on):
      - 7-day retention: ~$100/mo
      - 14-day retention: ~$200/mo
      - 28-day retention: ~$400/mo
      - Also requires bumping compute to at least the "Small" tier (~$15/mo) if not already there.
      - Where: Supabase Dashboard → Database → Backups → Point in Time.

## Business / legal

- [ ] **Move BOB from Elrod Financial, LLC (d/b/a BOB) into its own LLC** once the user base has
      grown (Gustin's plan as of 2026-10-05). Launching under Elrod Financial, LLC first. When the
      new company exists, the move involves:
      - Sign an IP/asset assignment moving the code, the BOB name, and the getbob.agency domain.
      - New Stripe account under the new LLC; ask Stripe support to migrate saved cards; new
        prices, webhook endpoint, and keys in Render; recreate/move subscriptions.
      - New EIN and bank account; update sales-tax registration and the DBA filing.
      - Update Terms, Privacy, and the footer with the new legal name (Terms section 14 already
        lets us transfer the agreement to an affiliate/successor); tell customers.
      - Billing contact updates on Supabase, Render, Resend, Cloudflare.
      Easier the earlier it's done (fewer subscriptions to move).
- [ ] Have an attorney review the Terms of Service and Privacy Policy (drafted 2026-10-05).
- [ ] File a DBA / fictitious-name registration for "BOB" if the state requires one.
- [ ] **Sales tax on subscriptions — deferred by Gustin (2026-10-06): "not collecting tax yet."**
      Code is already in place and OFF: set `STRIPE_AUTOMATIC_TAX=true` in Render to have Stripe
      calculate tax at checkout (billing address required). Before turning it on:
      1. Get a Texas Sales and Use Tax Permit (free, comptroller.texas.gov). Texas generally taxes
         SaaS as a data-processing service (80% of the price taxable) — confirm with the accountant.
      2. Stripe live: Settings > Tax: head office address, default tax code "SaaS – business use",
         default behavior Exclusive, add a Texas registration with the permit number, turn on
         monitoring for other states (thresholds, often ~$100k in a state).
      3. Optionally test first in the Stripe sandbox (any permit number works there), with a Texas
         ZIP (e.g. 78261) to see the tax line.
      Until then, Texas customers' purchases are untaxed — ask the accountant how to handle any
      Texas sales made before the permit exists.

## Done

- [x] **Contact path for prospective customers on the marketing page** — done 2026-10-06: Contact
      link in nav + footer, "Questions? Ask a real person." section with a mailto button, a FAQ
      entry, and a help line under the sign-in form. support@getbob.agency forwards to Gustin's
      inbox; replies go out as "BOB Support".

- [x] Add `sslmode=require` to Render's environment variables for `DATABASE_URL` and
      `DIRECT_URL` — confirmed live in production 2026-09-30.
- [x] **Prisma migrations couldn't rebuild the database from scratch** — fixed 2026-10-02 with
      `20260928999999_prereq_hand_made_indexes`, which creates production's hand-made `idx_*`
      indexes only where they're missing (a no-op in production). Verified by replaying all 21
      migrations into an empty schema: no errors, and the result diffed clean against
      `schema.prisma`. Takes effect in production on the next deploy (it will do nothing there).
