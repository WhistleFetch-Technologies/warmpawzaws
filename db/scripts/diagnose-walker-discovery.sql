-- ============================================================================
-- Diagnose why walkers are not discovered (discover-services?category=walker&serviceStyle=at_home)
-- Run this against your RDS/Postgres DB to see active walker vendors and what might exclude them.
-- ============================================================================

-- 1) All vendors that have a walker-related role (by role name)
SELECT
  v.id AS vendor_id,
  v.business_name,
  v.phone,
  v.status,
  v.is_active,
  v.role_id,
  r.name AS role_name,
  r.display_name AS role_display_name,
  (SELECT COUNT(*) FROM vendor_services vs WHERE vs.vendor_id = v.id AND vs.is_enabled = true) AS enabled_services_count,
  (SELECT COUNT(*) FROM vendor_services vs WHERE vs.vendor_id = v.id AND vs.is_enabled = true AND (vs.service_style = 'at_home' OR vs.service_style IS NULL)) AS at_home_or_null_count,
  (SELECT string_agg(vs.service_style || ':' || COALESCE(vs.publish_status, 'null'), ', ') FROM vendor_services vs WHERE vs.vendor_id = v.id AND vs.is_enabled = true) AS service_styles_and_publish
FROM vendors v
LEFT JOIN roles r ON v.role_id = r.id
WHERE r.name IS NOT NULL
  AND (
    LOWER(r.name) IN ('walker', 'walker_solo', 'pet_walker', 'dog_walker')
    OR LOWER(REPLACE(r.name, ' ', '_')) IN ('walker', 'walker_solo', 'pet_walker', 'dog_walker')
  )
ORDER BY v.business_name;

-- 2) Same vendors but only those that WOULD pass discovery filters (approved/active, is_active, has enabled service)
SELECT
  v.id,
  v.business_name,
  v.status,
  v.is_active,
  r.name AS role_name,
  CASE
    WHEN v.status NOT IN ('approved', 'active') THEN 'FAIL: status not approved/active'
    WHEN v.is_active IS NOT TRUE THEN 'FAIL: is_active not true'
    WHEN NOT EXISTS (SELECT 1 FROM vendor_services vs WHERE vs.vendor_id = v.id AND vs.is_enabled = true) THEN 'FAIL: no enabled vendor_services'
    WHEN COALESCE(LOWER(v.business_name), '') LIKE '%clinic%' THEN 'FAIL: business_name contains clinic'
    WHEN COALESCE(LOWER(v.business_name), '') LIKE '%hospital%' THEN 'FAIL: business_name contains hospital'
    WHEN COALESCE(LOWER(v.business_name), '') LIKE '%center%' THEN 'FAIL: business_name contains center'
    WHEN COALESCE(LOWER(v.business_name), '') LIKE '%centre%' THEN 'FAIL: business_name contains centre'
    WHEN COALESCE(LOWER(v.business_name), '') LIKE '%salon%' THEN 'FAIL: business_name contains salon'
    WHEN COALESCE(LOWER(v.business_name), '') LIKE '% business%' THEN 'FAIL: business_name contains space+business'
    ELSE 'OK'
  END AS discovery_check
FROM vendors v
LEFT JOIN roles r ON v.role_id = r.id
WHERE r.name IS NOT NULL
  AND (
    LOWER(r.name) IN ('walker', 'walker_solo', 'pet_walker', 'dog_walker')
    OR LOWER(REPLACE(r.name, ' ', '_')) IN ('walker', 'walker_solo', 'pet_walker', 'dog_walker')
  )
ORDER BY v.business_name;

-- 3) List all role names in DB that contain 'walk' (to see exact spelling)
SELECT id, name, display_name, is_active FROM roles WHERE LOWER(name) LIKE '%walk%' OR LOWER(display_name) LIKE '%walk%';

-- 4) Vendors with NULL role_id (would never match role filter)
SELECT id, business_name, phone, status, is_active, role_id FROM vendors WHERE role_id IS NULL AND (business_name ILIKE '%walker%' OR business_name ILIKE '%walk%');
