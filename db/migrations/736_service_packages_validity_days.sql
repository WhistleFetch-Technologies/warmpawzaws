-- ============================================================================
-- MIGRATION 736: service_packages.validity_days (vendor catalog / Razorpay)
-- ============================================================================
-- Lambda insertVendorServiceCatalogPackage() inserts validity_days; legacy
-- service_packages (057) only had duration_days. DBs without this column error:
-- column "validity_days" of relation "service_packages" does not exist
-- ============================================================================

ALTER TABLE service_packages
  ADD COLUMN IF NOT EXISTS validity_days INTEGER DEFAULT 30;

COMMENT ON COLUMN service_packages.validity_days IS
  'How many calendar days the purchased package remains valid from activation (vendor_service shadow catalog).';

-- Prefer legacy duration_days when it was used as a validity window
UPDATE service_packages sp
SET validity_days = GREATEST(1, sp.duration_days::integer)
WHERE sp.duration_days IS NOT NULL
  AND sp.duration_days > 0
  AND sp.duration_days::integer IS DISTINCT FROM sp.validity_days;
