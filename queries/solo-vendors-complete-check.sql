-- ============================================================================
-- SOLO VENDORS COMPLETE CHECK - SQL Queries
-- ============================================================================
-- Run these queries in your database to find solo vendors and their status
-- ============================================================================

-- ============================================================================
-- QUERY 1: Find All Solo Vendors
-- ============================================================================
-- This shows all vendors configured as solo providers
-- ============================================================================

SELECT 
  v.id as vendor_id,
  v.business_name,
  v.owner_name,
  v.phone,
  v.vendor_configuration,
  v.status,
  v.is_active,
  r.name as role_name,
  r.config->>'vendorConfiguration' as role_vendor_config
FROM vendors v
LEFT JOIN roles r ON v.role_id = r.id
WHERE v.status = 'approved' 
  AND v.is_active = true
  AND (
    v.vendor_configuration = 'solo'
    OR (v.metadata IS NOT NULL AND (v.metadata->>'vendorConfiguration')::text = 'solo')
    OR r.name LIKE '%_solo'
    OR r.name LIKE 'solo_%'
    OR EXISTS (
      SELECT 1 FROM roles r2 
      WHERE r2.id = v.role_id 
      AND (r2.config->>'vendorConfiguration')::text = 'solo'
    )
  )
ORDER BY v.business_name;

-- ============================================================================
-- QUERY 2: Find Solo Vendors with at_home/tele Services
-- ============================================================================
-- This shows all at_home and tele services for solo vendors
-- ============================================================================

SELECT 
  v.id as vendor_id,
  v.business_name,
  vs.id as service_id,
  vs.service_name,
  vs.service_style,
  vs.is_enabled,
  vs.publish_status,
  vs.price,
  vs.duration_minutes,
  vs.category,
  vs.sub_category
FROM vendors v
LEFT JOIN roles r ON v.role_id = r.id
INNER JOIN vendor_services vs ON vs.vendor_id = v.id
WHERE v.status = 'approved' 
  AND v.is_active = true
  AND vs.service_style IN ('at_home', 'tele')
  AND (
    v.vendor_configuration = 'solo'
    OR (v.metadata IS NOT NULL AND (v.metadata->>'vendorConfiguration')::text = 'solo')
    OR r.name LIKE '%_solo'
    OR r.name LIKE 'solo_%'
    OR EXISTS (
      SELECT 1 FROM roles r2 
      WHERE r2.id = v.role_id 
      AND (r2.config->>'vendorConfiguration')::text = 'solo'
    )
  )
ORDER BY v.business_name, vs.service_style, vs.service_name;

-- ============================================================================
-- QUERY 3: Count Services by Style for Solo Vendors
-- ============================================================================
-- This shows service counts grouped by style
-- ============================================================================

SELECT 
  v.id as vendor_id,
  v.business_name,
  COUNT(CASE WHEN vs.service_style = 'at_home' THEN 1 END) as at_home_count,
  COUNT(CASE WHEN vs.service_style = 'tele' THEN 1 END) as tele_count,
  COUNT(CASE WHEN vs.service_style = 'at_center' THEN 1 END) as at_center_count,
  COUNT(*) as total_services
FROM vendors v
LEFT JOIN roles r ON v.role_id = r.id
INNER JOIN vendor_services vs ON vs.vendor_id = v.id
WHERE v.status = 'approved' 
  AND v.is_active = true
  AND vs.is_enabled = true
  AND (
    v.vendor_configuration = 'solo'
    OR (v.metadata IS NOT NULL AND (v.metadata->>'vendorConfiguration')::text = 'solo')
    OR r.name LIKE '%_solo'
    OR r.name LIKE 'solo_%'
    OR EXISTS (
      SELECT 1 FROM roles r2 
      WHERE r2.id = v.role_id 
      AND (r2.config->>'vendorConfiguration')::text = 'solo'
    )
  )
GROUP BY v.id, v.business_name
ORDER BY v.business_name;

-- ============================================================================
-- QUERY 4: Check Schedule Configuration for Solo Vendors
-- ============================================================================
-- This shows which vendors have schedules configured
-- ============================================================================

SELECT 
  v.id as vendor_id,
  v.business_name,
  COALESCE(va_count.count, 0) as vendor_availability_count,
  COALESCE(vss_count.count, 0) as vendor_schedule_slots_count,
  CASE 
    WHEN COALESCE(va_count.count, 0) > 0 OR COALESCE(vss_count.count, 0) > 0 
    THEN '✅ Has Schedule'
    ELSE '❌ Missing Schedule'
  END as schedule_status
FROM vendors v
LEFT JOIN roles r ON v.role_id = r.id
LEFT JOIN (
  SELECT vendor_id, COUNT(*) as count
  FROM vendor_availability_v2
  GROUP BY vendor_id
) va_count ON va_count.vendor_id = v.id
LEFT JOIN (
  SELECT vendor_id, COUNT(*) as count
  FROM vendor_schedule_slots
  WHERE is_enabled = true
  GROUP BY vendor_id
) vss_count ON vss_count.vendor_id = v.id
WHERE v.status = 'approved' 
  AND v.is_active = true
  AND (
    v.vendor_configuration = 'solo'
    OR (v.metadata IS NOT NULL AND (v.metadata->>'vendorConfiguration')::text = 'solo')
    OR r.name LIKE '%_solo'
    OR r.name LIKE 'solo_%'
    OR EXISTS (
      SELECT 1 FROM roles r2 
      WHERE r2.id = v.role_id 
      AND (r2.config->>'vendorConfiguration')::text = 'solo'
    )
  )
ORDER BY v.business_name;

-- ============================================================================
-- QUERY 5: COMPLETE READINESS REPORT (MOST IMPORTANT!)
-- ============================================================================
-- This is the comprehensive report showing everything you need to know
-- Run this query FIRST to see the complete status
-- ============================================================================

SELECT 
  v.id as vendor_id,
  v.business_name,
  v.owner_name,
  v.phone,
  v.vendor_configuration,
  r.name as role_name,
  r.config->>'vendorConfiguration' as role_vendor_config,
  -- Service counts
  COUNT(DISTINCT CASE WHEN vs.service_style = 'at_home' AND vs.is_enabled = true AND vs.publish_status = 'published' THEN vs.id END) as at_home_published,
  COUNT(DISTINCT CASE WHEN vs.service_style = 'tele' AND vs.is_enabled = true AND vs.publish_status = 'published' THEN vs.id END) as tele_published,
  -- Schedule status
  CASE 
    WHEN EXISTS (SELECT 1 FROM vendor_availability_v2 va WHERE va.vendor_id = v.id)
      OR EXISTS (SELECT 1 FROM vendor_schedule_slots vss WHERE vss.vendor_id = v.id AND vss.is_enabled = true)
    THEN '✅'
    ELSE '❌'
  END as has_schedule,
  -- Overall status
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN vs.service_style IN ('at_home', 'tele') AND vs.is_enabled = true AND vs.publish_status = 'published' THEN vs.id END) > 0
      AND (EXISTS (SELECT 1 FROM vendor_availability_v2 va WHERE va.vendor_id = v.id)
           OR EXISTS (SELECT 1 FROM vendor_schedule_slots vss WHERE vss.vendor_id = v.id AND vss.is_enabled = true))
    THEN '✅ Ready'
    ELSE '⚠️  Not Ready'
  END as discovery_status
FROM vendors v
LEFT JOIN roles r ON v.role_id = r.id
LEFT JOIN vendor_services vs ON vs.vendor_id = v.id
WHERE v.status = 'approved' 
  AND v.is_active = true
  AND (
    v.vendor_configuration = 'solo'
    OR (v.metadata IS NOT NULL AND (v.metadata->>'vendorConfiguration')::text = 'solo')
    OR r.name LIKE '%_solo'
    OR r.name LIKE 'solo_%'
    OR EXISTS (
      SELECT 1 FROM roles r2 
      WHERE r2.id = v.role_id 
      AND (r2.config->>'vendorConfiguration')::text = 'solo'
    )
  )
GROUP BY v.id, v.business_name, v.owner_name, v.phone, v.vendor_configuration, r.name, r.config
ORDER BY discovery_status DESC, v.business_name;

-- ============================================================================
-- INTERPRETATION GUIDE
-- ============================================================================
-- 
-- discovery_status = '✅ Ready'
--   → Vendor will appear in at_home/tele listings
--   → Has published services AND schedule configured
--
-- discovery_status = '⚠️  Not Ready'
--   → Vendor will NOT appear in listings
--   → Check:
--      - at_home_published = 0? → Services not published
--      - tele_published = 0? → Services not published
--      - has_schedule = '❌'? → Schedule not configured
--
-- ============================================================================
