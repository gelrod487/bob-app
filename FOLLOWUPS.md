# Follow-ups

Running list of deferred action items — things that are deliberate "not now" decisions, not bugs.

## Security

- [ ] **Enable Point-in-Time Recovery (PITR) in Supabase** once BOB has ~12 active producer
      accounts. Currently relying on Supabase's free daily backups only, which can lose up to
      a day of data if something goes wrong. PITR lets you restore to any exact minute, at a
      cost (Pro plan add-on):
      - 7-day retention: ~$100/mo
      - 14-day retention: ~$200/mo
      - 28-day retention: ~$400/mo
      - Also requires bumping compute to at least the "Small" tier (~$15/mo) if not already there.
      - Where: Supabase Dashboard → Database → Backups → Point in Time.

- [ ] **Add `sslmode=require` to Render's environment variables** for `DATABASE_URL` and
      `DIRECT_URL`. Already done locally in `.env` (added 2026-09-30) — Render's production
      env still needs the same values applied for it to take effect there.
