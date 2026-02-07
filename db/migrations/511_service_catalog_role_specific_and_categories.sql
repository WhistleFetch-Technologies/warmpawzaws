-- ============================================================================
-- MIGRATION 511: SERVICE CATALOG ROLE-SPECIFIC DISCOVERY & CATEGORY BACKFILL
-- ============================================================================
-- Purpose:
-- 1. Backfill category_name from service_categories where NULL/empty so no
--    "Uncategorized" headers appear in vendor Browse Catalog.
-- 2. Make Diagnostics & Lab strictly diagnostics_center only (remove vet_clinic,
--    veterinarian) so vet vendor dashboard does not show diagnostic services.
-- ============================================================================

-- ============================================================================
-- STEP 1: Backfill category_name from service_categories where missing
-- ============================================================================
UPDATE service_catalog sc
SET category_name = COALESCE(NULLIF(TRIM(sc.category_name), ''), cat.name)
FROM service_categories cat
WHERE cat.category_id = sc.category_id
  AND (sc.category_name IS NULL OR TRIM(sc.category_name) = '');

-- For rows with category_id but no matching service_categories row, set from category_id
UPDATE service_catalog
SET category_name = CASE category_id
  WHEN 'veterinary' THEN 'Veterinary Services'
  WHEN 'grooming' THEN 'Grooming & Hygiene'
  WHEN 'training' THEN 'Training & Behavior'
  WHEN 'boarding' THEN 'Boarding & Daycare'
  WHEN 'walking' THEN 'Walking & Exercise'
  WHEN 'diagnostic' THEN 'Diagnostics & Lab'
  WHEN 'pharmacy' THEN 'Pharmacy & Medication'
  WHEN 'emergency' THEN 'Emergency Services'
  WHEN 'wellness' THEN 'Wellness & Nutrition'
  WHEN 'specialty' THEN 'Specialty Services'
  ELSE COALESCE(category_name, 'General')
END
WHERE (category_name IS NULL OR TRIM(category_name) = '')
  AND category_id IS NOT NULL;

-- ============================================================================
-- STEP 2: Diagnostics & Lab — diagnostics_center ONLY (remove vet_clinic, veterinarian)
-- ============================================================================
UPDATE service_catalog
SET applicable_roles = ARRAY['diagnostics_center']
WHERE (category_id = 'diagnostic' OR category_name ILIKE '%diagnostic%' OR service_id LIKE 'diag_%');

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
DECLARE
  null_cat INTEGER;
  diag_roles TEXT;
BEGIN
  SELECT COUNT(*) INTO null_cat FROM service_catalog
  WHERE status = 'active' AND (category_name IS NULL OR TRIM(category_name) = '');
  RAISE NOTICE 'Service catalog: % active rows with NULL/empty category_name (target 0)', null_cat;

  SELECT array_to_string(applicable_roles, ',') INTO diag_roles
  FROM service_catalog
  WHERE category_id = 'diagnostic' LIMIT 1;
  RAISE NOTICE 'Diagnostic services applicable_roles sample: % (expected: diagnostics_center only)', diag_roles;
END $$;
