-- ============================================================================
-- MIGRATION 1068: Backfill service_catalog parent category (UUID + "General")
-- ============================================================================
-- Fixes rows where category_id was saved as service_categories.id (UUID) and/or
-- category_name was set to "General" (specialization label, not parent category).
--
-- Rollback: scripts/apply-migration-1068-catalog-category-backfill.js --rollback
-- Backup table: service_catalog_category_backfill_20260713
-- ============================================================================

-- Step 1: Snapshot affected rows (idempotent)
CREATE TABLE IF NOT EXISTS service_catalog_category_backfill_20260713 (
  id UUID PRIMARY KEY,
  service_id TEXT,
  service_name TEXT,
  category_id TEXT,
  category_name TEXT,
  updated_at TIMESTAMPTZ
);

INSERT INTO service_catalog_category_backfill_20260713 (
  id, service_id, service_name, category_id, category_name, updated_at
)
SELECT
  sc.id,
  sc.service_id,
  sc.service_name,
  sc.category_id,
  sc.category_name,
  sc.updated_at
FROM service_catalog sc
WHERE (
  TRIM(COALESCE(sc.category_name, '')) = 'General'
  OR sc.category_id ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
)
ON CONFLICT (id) DO NOTHING;

-- Step 2: UUID category_id → slug + service_categories.name
UPDATE service_catalog sc
SET
  category_id = cat.category_id::text,
  category_name = cat.name::text,
  updated_at = NOW()
FROM service_categories cat
WHERE cat.id::text = sc.category_id
  AND sc.category_id ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$';

-- Step 3: Slug category_id but misleading "General" category_name
UPDATE service_catalog sc
SET
  category_name = cat.name::text,
  updated_at = NOW()
FROM service_categories cat
WHERE cat.category_id = sc.category_id
  AND TRIM(COALESCE(sc.category_name, '')) = 'General'
  AND sc.category_id IS NOT NULL
  AND sc.category_id !~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$';
