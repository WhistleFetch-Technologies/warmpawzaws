-- ============================================================================
-- MIGRATION 619: Normalize service_catalog.category_id when it was set to
-- service_categories.id (UUID) instead of the human-readable category_id slug.
-- ============================================================================
-- Fixes Marketing > Service Launch showing raw UUIDs and aligns catalog rows
-- with service_categories.category_id (e.g. pet-sitter) + proper category_name.
-- ============================================================================

UPDATE service_catalog sc
SET
  category_id = cat.category_id::text,
  category_name = COALESCE(NULLIF(TRIM(sc.category_name), ''), cat.name::text, sc.category_name)
FROM service_categories cat
WHERE cat.id::text = sc.category_id
  AND sc.category_id ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$';
