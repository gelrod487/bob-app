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

## Done

- [x] Add `sslmode=require` to Render's environment variables for `DATABASE_URL` and
      `DIRECT_URL` — confirmed live in production 2026-09-30.
- [x] **Prisma migrations couldn't rebuild the database from scratch** — fixed 2026-10-02 with
      `20260928999999_prereq_hand_made_indexes`, which creates production's hand-made `idx_*`
      indexes only where they're missing (a no-op in production). Verified by replaying all 21
      migrations into an empty schema: no errors, and the result diffed clean against
      `schema.prisma`. Takes effect in production on the next deploy (it will do nothing there).
