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

## Before launch

- [ ] **Add a way for prospective customers to contact BOB on the marketing page.** (Gustin,
      2026-10-06 — do right after the Stripe live-mode switch.) Today the homepage has no "Contact
      us" anywhere. support@getbob.agency now exists (Cloudflare Email Routing -> Gustin's inbox;
      replies go out as "BOB Support" via Gmail Send-mail-as + Resend SMTP). Add: a Contact link in
      the footer + nav, a short Contact/Support section or page with the email, and mention it in the
      FAQ ("Questions? Email support@getbob.agency"). Consider a simple contact form later.

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
- [ ] Decide on sales tax for subscriptions (Stripe Tax) before going live.

## Done

- [x] Add `sslmode=require` to Render's environment variables for `DATABASE_URL` and
      `DIRECT_URL` — confirmed live in production 2026-09-30.
- [x] **Prisma migrations couldn't rebuild the database from scratch** — fixed 2026-10-02 with
      `20260928999999_prereq_hand_made_indexes`, which creates production's hand-made `idx_*`
      indexes only where they're missing (a no-op in production). Verified by replaying all 21
      migrations into an empty schema: no errors, and the result diffed clean against
      `schema.prisma`. Takes effect in production on the next deploy (it will do nothing there).
