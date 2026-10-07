-- Prisma's own bookkeeping table was skipped by the earlier "enable RLS on every table" migration.
-- Supabase flags it (and its public REST API could read/write it). Turn row-level security on, with
-- no policies, like every other table. Prisma connects as the table owner, which bypasses RLS, so
-- `prisma migrate` keeps working. Harmless where it's already enabled.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
