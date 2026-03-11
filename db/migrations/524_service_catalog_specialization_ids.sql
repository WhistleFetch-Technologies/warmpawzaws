-- ============================================================================
-- MIGRATION 524: SERVICE CATALOG - SPECIALIZATION IDS (MULTI-SELECT)
-- ============================================================================
-- Date: 2026-02-02
-- Purpose: Link service_catalog to specialization_master via specialization_ids
--          so each service can be tagged with one or more specializations
--          (e.g. General Health, Surgery, Dental for vet services).
-- 360 flow: Category → Specializations (vendor profile) → Services (catalog)
--           Services can list which specializations they belong to.
-- ============================================================================

ALTER TABLE service_catalog
  ADD COLUMN IF NOT EXISTS specialization_ids TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN service_catalog.specialization_ids IS 'Specialization IDs from specialization_master (e.g. general_health, surgery). Used for vendor profile matching and problem-grid to service mapping.';

CREATE INDEX IF NOT EXISTS idx_service_catalog_specialization_ids
  ON service_catalog USING GIN(specialization_ids);

-- ============================================================================
-- END OF MIGRATION 524
-- ============================================================================
