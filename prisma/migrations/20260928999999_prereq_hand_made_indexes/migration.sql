-- Repair for rebuilding the database from scratch.
--
-- Production had twelve indexes named idx_* that were created by hand, outside Prisma. The
-- later migration 20260929000000_fk_indexes renames them to Prisma's naming (*_idx), which
-- only works where those hand-made indexes already exist — on a brand-new database it fails.
--
-- This runs just before that migration and creates each hand-made index ONLY when neither
-- the old name nor the final name exists:
--   * production / any database that already has the *_idx names: every check fails, so this
--     does nothing at all;
--   * a fresh database: creates the idx_* index so the rename right after has something to
--     rename, ending in exactly the same state as production.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('idx_agency_parent_agency_id',     'agency_parent_agency_id_idx',     'agency',            'parent_agency_id'),
      ('idx_client_producer_id',          'client_producer_id_idx',          'client',            'producer_id'),
      ('idx_commission_entry_agency_id',  'commission_entry_agency_id_idx',  'commission_entry',  'agency_id'),
      ('idx_commission_entry_policy_id',  'commission_entry_policy_id_idx',  'commission_entry',  'policy_id'),
      ('idx_commission_entry_producer_id','commission_entry_producer_id_idx','commission_entry',  'producer_id'),
      ('idx_expense_agency_id',           'expense_agency_id_idx',           'expense',           'agency_id'),
      ('idx_expense_producer_id',         'expense_producer_id_idx',         'expense',           'producer_id'),
      ('idx_owner_draw_agency_id',        'owner_draw_agency_id_idx',        'owner_draw',        'agency_id'),
      ('idx_payment_reminder_policy_id',  'payment_reminder_policy_id_idx',  'payment_reminder',  'policy_id'),
      ('idx_policy_client_id',            'policy_client_id_idx',            'policy',            'client_id'),
      ('idx_producer_agency_id',          'producer_agency_id_idx',          'producer',          'agency_id'),
      ('idx_suggestion_producer_id',      'suggestion_producer_id_idx',      'suggestion',        'producer_id')
    ) AS t(old_name, new_name, tbl, col)
  LOOP
    IF to_regclass(format('%I.%I', current_schema(), r.new_name)) IS NULL
       AND to_regclass(format('%I.%I', current_schema(), r.old_name)) IS NULL THEN
      EXECUTE format('CREATE INDEX %I ON %I.%I (%I)', r.old_name, current_schema(), r.tbl, r.col);
    END IF;
  END LOOP;
END $$;
