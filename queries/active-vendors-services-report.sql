-- ============================================================================
-- ACTIVE VENDORS & SERVICES REPORT (DB search driven)
-- ============================================================================
-- Run to see: active vendors count, roles, services configured, packages, styles
-- Usage: node scripts/run-db-report.js  OR  psql $DATABASE_URL -f queries/active-vendors-services-report.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ACTIVE VENDORS COUNT
-- ----------------------------------------------------------------------------
SELECT
  COUNT(*) AS active_vendors_count
FROM vendors v
WHERE v.status = 'approved'
  AND v.is_active = true;

-- ----------------------------------------------------------------------------
-- 2. ACTIVE VENDORS BY ROLE (role name and count)
-- ----------------------------------------------------------------------------
SELECT
  r.name AS role_name,
  r.display_name AS role_display_name,
  COUNT(v.id) AS vendor_count
FROM vendors v
INNER JOIN roles r ON v.role_id = r.id
WHERE v.status = 'approved'
  AND v.is_active = true
  AND r.is_active = true
GROUP BY r.id, r.name, r.display_name
ORDER BY vendor_count DESC, r.name;

-- ----------------------------------------------------------------------------
-- 3. VENDOR SERVICES CONFIGURED (by vendor: count and styles)
-- ----------------------------------------------------------------------------
SELECT
  v.id AS vendor_id,
  v.business_name,
  r.name AS role_name,
  COUNT(vs.id) AS services_count,
  COUNT(CASE WHEN vs.service_style = 'at_center' AND vs.is_enabled = true AND (vs.publish_status = 'published' OR vs.publish_status IS NULL) THEN 1 END) AS at_center_published,
  COUNT(CASE WHEN vs.service_style = 'at_home' AND vs.is_enabled = true AND (vs.publish_status = 'published' OR vs.publish_status IS NULL) THEN 1 END) AS at_home_published,
  COUNT(CASE WHEN vs.service_style = 'tele' AND vs.is_enabled = true AND (vs.publish_status = 'published' OR vs.publish_status IS NULL) THEN 1 END) AS tele_published
FROM vendors v
INNER JOIN roles r ON v.role_id = r.id
LEFT JOIN vendor_services vs ON vs.vendor_id = v.id
WHERE v.status = 'approved'
  AND v.is_active = true
GROUP BY v.id, v.business_name, r.name
ORDER BY v.business_name, r.name;

-- ----------------------------------------------------------------------------
-- 4. SERVICE STYLES IN USE (distinct styles with published services)
-- ----------------------------------------------------------------------------
SELECT
  vs.service_style,
  COUNT(DISTINCT vs.vendor_id) AS vendors_with_style,
  COUNT(vs.id) AS services_count
FROM vendor_services vs
INNER JOIN vendors v ON v.id = vs.vendor_id
WHERE v.status = 'approved'
  AND v.is_active = true
  AND vs.is_enabled = true
  AND (vs.publish_status = 'published' OR vs.publish_status IS NULL)
GROUP BY vs.service_style
ORDER BY vs.service_style;

-- ----------------------------------------------------------------------------
-- 5. PACKAGES CONFIGURED (service_packages per vendor, if table exists)
-- ----------------------------------------------------------------------------
SELECT
  v.id AS vendor_id,
  v.business_name,
  r.name AS role_name,
  COUNT(sp.id) AS package_count
FROM vendors v
INNER JOIN roles r ON v.role_id = r.id
LEFT JOIN service_packages sp ON sp.vendor_id = v.id AND sp.is_active = true
WHERE v.status = 'approved'
  AND v.is_active = true
GROUP BY v.id, v.business_name, r.name
HAVING COUNT(sp.id) > 0
ORDER BY package_count DESC, v.business_name;

-- ----------------------------------------------------------------------------
-- 6. DIAGNOSTIC PACKAGES (if diagnostic_packages table exists)
-- ----------------------------------------------------------------------------
SELECT
  v.id AS vendor_id,
  v.business_name,
  COUNT(dp.id) AS diagnostic_package_count
FROM vendors v
LEFT JOIN diagnostic_packages dp ON dp.vendor_id = v.id AND dp.is_active = true
WHERE v.status = 'approved'
  AND v.is_active = true
GROUP BY v.id, v.business_name
HAVING COUNT(dp.id) > 0
ORDER BY diagnostic_package_count DESC, v.business_name;

-- ----------------------------------------------------------------------------
-- 7. ROLES THAT HAVE DISCOVERABLE VENDORS (for discovery meta)
-- ----------------------------------------------------------------------------
SELECT DISTINCT
  r.name AS role_name,
  r.display_name AS role_display_name
FROM vendors v
INNER JOIN roles r ON v.role_id = r.id
INNER JOIN vendor_services vs ON vs.vendor_id = v.id
WHERE v.status = 'approved'
  AND v.is_active = true
  AND r.is_active = true
  AND vs.is_enabled = true
  AND (vs.publish_status = 'published' OR vs.publish_status IS NULL)
ORDER BY r.name;
