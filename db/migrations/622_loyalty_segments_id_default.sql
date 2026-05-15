-- ============================================================================
-- 622: loyalty_segments.id default (dev / legacy tables)
-- ============================================================================
-- dev_insert_loyalty_segments.sql used: id uuid PRIMARY KEY (no DEFAULT).
-- App inserts without id then fail: null value in column "id" violates not-null.
-- Migration 064 uses DEFAULT gen_random_uuid() but CREATE IF NOT EXISTS skips
-- existing tables. This ALTER aligns live RDS with expected behavior.
-- ============================================================================

ALTER TABLE loyalty_segments
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

COMMENT ON COLUMN loyalty_segments.id IS 'PK; default gen_random_uuid() if not supplied';
