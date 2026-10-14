# Follow-ups

Running list of deferred action items — things that are deliberate "not now" decisions, not bugs.

## Security

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
- [ ] **Sales tax on subscriptions — live and verified (updated 2026-10-14).**
      Done: Texas taxpayer number obtained (permit paper arrives ~2-3 weeks); Stripe Tax live with head office
      in TX, preset category "SaaS - business use", tax added on top, Texas registration active, all 3 live
      products tagged SaaS - business use, `STRIPE_AUTOMATIC_TAX=true` set in Render, and a live checkout was
      confirmed to add tax (Texas ~$1.91 on $29). Still worth asking the accountant / Comptroller
      (1-800-252-5555) whether collecting before the paper permit arrives is OK.
      Recurring: Texas return is QUARTERLY — first due 11/20/2026, must be filed even with $0 sales (Comptroller
      WebFile, free; totals in Stripe Tax > Reports). Keep the taxpayer number + WebFile login in the password
      manager. Do NOT buy Stripe's paid filing add-on unless filing becomes a burden. Register in other
      states only when Stripe's threshold emails say so (usually ~$100k in a state; TX/CA/NY use $500k).
- [ ] **Automatic emails (welcome + trial-ending) — built 2026-10-14, needs the Resend key to go live.** Create a Resend API
      key (Sending access) and add `RESEND_API_KEY` in Render > Environment. Then Admin > Overview > "Automatic emails" lets
      you email yourself a sample of each. Sent through `src/lib/lifecycleEmails.js`: welcome at sign-up, trial-ending notice
      48 hours before the trial ends (hourly sweep). Existing accounts were marked "already sent" so only new signups get them.
- [ ] **Uptime monitor.** Point UptimeRobot / Better Stack at `https://getbob.agency/api/health` (200 = up, 503 = database down).
      Optional: set `healthCheckPath: /api/health` for the web service so Render also uses it.
## Product follow-ups

- [x] Agency owner's Profit tab unit economics now use the owner's own commissions/activity (fixed with the new Unit economics definitions, 2026-10-12). Still open: Health of the book's Gross Margin subtracts only the owner's own lead spend from team-wide gross.

## Done

- [x] **Point-in-Time Recovery enabled in Supabase (bob-app)** — 2026-10-14, ahead of opening BOB to the Founding 75.
- [x] Resend upgraded to a paid plan and Supabase hourly auth-email limit raised 30 -> 200 — 2026-10-14.

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
