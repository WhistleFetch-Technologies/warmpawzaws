-- ============================================================================
-- MIGRATION 722: Admin catalogue — service_categories extra columns
-- ============================================================================
-- Lambda POST /admin/catalog/categories and seed scripts expect:
--   - has_problem_grid (problem-grid UX per category)
--   - vendor_roles (TEXT[] of role ids / keys allowed for this category)
-- Production DBs that only ran older migrations (e.g. 711) lack these columns
-- and return: column "has_problem_grid" of relation "service_categories" does not exist
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'service_categories' AND column_name = 'has_problem_grid'
  ) THEN
    ALTER TABLE service_categories
      ADD COLUMN has_problem_grid BOOLEAN NOT NULL DEFAULT false;
    RAISE NOTICE 'Added has_problem_grid to service_categories';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'service_categories' AND column_name = 'vendor_roles'
  ) THEN
    ALTER TABLE service_categories
      ADD COLUMN vendor_roles TEXT[] NOT NULL DEFAULT '{}'::text[];
    RAISE NOTICE 'Added vendor_roles to service_categories';
  END IF;
END $$;

COMMENT ON COLUMN service_categories.has_problem_grid IS 'When true, customer flows may show problem/symptom grid for this catalogue category';
COMMENT ON COLUMN service_categories.vendor_roles IS 'Role identifiers allowed to offer services under this category (admin catalogue)';
