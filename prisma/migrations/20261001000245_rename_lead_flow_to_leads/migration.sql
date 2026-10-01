-- Renaming the "Lead flow" cost category to "Leads". category is a plain string
-- column (no enum/FK), so existing rows need this data migration or they'd silently
-- stop matching the new allowlist/chart grouping.
UPDATE "expense" SET "category" = 'Leads' WHERE "category" = 'Lead flow';
