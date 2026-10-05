-- Turn on row-level security for every table in the public schema.
--
-- Why: Supabase exposes public-schema tables over its REST API to anyone holding the
-- (deliberately public) publishable key. With RLS off, that key can read AND write the table
-- with no login. BOB never uses that path — all data access goes through the Express API
-- using the database owner role (Prisma), which bypasses RLS — so we enable RLS and add no
-- policies: the REST API sees nothing and can change nothing, and the app is unaffected.
--
-- Production already had RLS on for the original tables; this closes the gap for tables added
-- later (audit_log, feature_flag, announcement, known_imo) and keeps any future table covered
-- as long as a migration like this is re-run. Re-enabling on an already-protected table is a no-op.
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '\_prisma%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
