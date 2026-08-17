-- ============================================================================
-- 1089: Link leftover Admin GST cards to catalogue + roles
-- ============================================================================
-- Diagnostic Labs  → diagnostic (lab SKUs) + Diagnostics Center (diagnostics_center)
-- Vet Pharmacy     → pharmacy (3 SKUs) + Pet Pharmacy (pharmacy / pet_pharmacy)
-- Pet Training     → add behaviorist_center / behaviorist_solo (catalogue already training)
-- Idempotent. Does not drop or overwrite other GST rows.
-- ============================================================================

-- 1) Diagnostic Labs → Diagnostics & Lab master
UPDATE tax_categories tc
SET catalog_category_id = sc.id
FROM service_categories sc
WHERE LOWER(TRIM(tc.category_name)) = 'diagnostic labs'
  AND sc.category_id = 'diagnostic'
  AND COALESCE(tc.gst_application_scope, 'service_booking') = 'service_booking'
  AND tc.catalog_category_id IS DISTINCT FROM sc.id;

INSERT INTO tax_category_roles (tax_category_id, role_id, catalog_category_id)
SELECT tc.id, r.id, sc.id
FROM tax_categories tc
JOIN service_categories sc ON sc.category_id = 'diagnostic'
JOIN roles r ON COALESCE(r.is_active, true) = true
  AND (
    LOWER(TRIM(r.name)) = 'diagnostics_center'
    OR LOWER(TRIM(r.display_name)) = 'diagnostics center'
  )
WHERE LOWER(TRIM(tc.category_name)) = 'diagnostic labs'
  AND COALESCE(tc.gst_application_scope, 'service_booking') = 'service_booking'
  AND tc.catalog_category_id = sc.id
ON CONFLICT (tax_category_id, role_id) DO NOTHING;

-- 2) Vet Pharmacy → Pharmacy master
UPDATE tax_categories tc
SET catalog_category_id = sc.id
FROM service_categories sc
WHERE LOWER(TRIM(tc.category_name)) = 'vet pharmacy'
  AND sc.category_id = 'pharmacy'
  AND COALESCE(tc.gst_application_scope, 'service_booking') = 'service_booking'
  AND tc.catalog_category_id IS DISTINCT FROM sc.id;

INSERT INTO tax_category_roles (tax_category_id, role_id, catalog_category_id)
SELECT tc.id, r.id, sc.id
FROM tax_categories tc
JOIN service_categories sc ON sc.category_id = 'pharmacy'
JOIN roles r ON COALESCE(r.is_active, true) = true
  AND (
    LOWER(TRIM(r.name)) IN ('pharmacy', 'pet_pharmacy')
    OR LOWER(TRIM(r.display_name)) = 'pet pharmacy'
  )
WHERE LOWER(TRIM(tc.category_name)) = 'vet pharmacy'
  AND COALESCE(tc.gst_application_scope, 'service_booking') = 'service_booking'
  AND tc.catalog_category_id = sc.id
ON CONFLICT (tax_category_id, role_id) DO NOTHING;

-- 3) Pet Training Services → keep training catalogue; add behaviorist roles
INSERT INTO tax_category_roles (tax_category_id, role_id, catalog_category_id)
SELECT tc.id, r.id, sc.id
FROM tax_categories tc
JOIN service_categories sc ON sc.id = tc.catalog_category_id AND sc.category_id = 'training'
JOIN roles r ON r.name IN ('behaviorist_center', 'behaviorist_solo') AND COALESCE(r.is_active, true) = true
WHERE LOWER(TRIM(tc.category_name)) = 'pet training services'
  AND COALESCE(tc.gst_application_scope, 'service_booking') = 'service_booking'
ON CONFLICT (tax_category_id, role_id) DO NOTHING;
