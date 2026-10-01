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
