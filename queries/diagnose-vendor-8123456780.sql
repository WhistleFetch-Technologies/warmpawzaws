-- ============================================================================
-- Diagnostic Query: Vendor 8123456780
-- ============================================================================
-- Run this query to get complete diagnostic data for vendor 8123456780
-- This will show which condition is preventing the vendor from appearing
-- ============================================================================

SELECT 
  -- Vendor Basic Info
  v.id,
  v.phone,
  v.status,
  v.is_active,
  v.vendor_configuration,
  v.role_id,
  
  -- Role Configuration
  r.name as role_name,
  r.display_name as role_display_name,
  r.config->>'vendorConfiguration' as role_vendor_config,
  r.config->'vendorTypes' as role_vendor_types,
  
  -- Service Counts (at_home and tele)
  (SELECT COUNT(*) 
   FROM vendor_services vs 
   WHERE vs.vendor_id = v.id 
     AND vs.service_style IN ('at_home', 'tele') 
     AND vs.is_enabled = true 
     AND vs.publish_status = 'published'
  ) as services_count_at_home_tele,
  
  -- Individual Service Details
  (SELECT COUNT(*) 
   FROM vendor_services vs 
   WHERE vs.vendor_id = v.id 
     AND vs.service_style = 'at_home' 
     AND vs.is_enabled = true 
     AND vs.publish_status = 'published'
  ) as services_count_at_home,
  
  (SELECT COUNT(*) 
   FROM vendor_services vs 
   WHERE vs.vendor_id = v.id 
     AND vs.service_style = 'tele' 
     AND vs.is_enabled = true 
     AND vs.publish_status = 'published'
  ) as services_count_tele,
  
  -- Schedule Configuration
  (SELECT COUNT(*) 
   FROM vendor_availability_v2 va 
   WHERE va.vendor_id = v.id
  ) as availability_count,
  
  (SELECT COUNT(*) 
   FROM vendor_schedule_slots vss 
   WHERE vss.vendor_id = v.id 
     AND vss.is_enabled = true
  ) as schedule_slots_count,
  
  -- Diagnostic Checks
  CASE 
    WHEN v.status = 'approved' AND v.is_active = true THEN '✅ Status OK'
    ELSE '❌ Status Issue'
  END as status_check,
  
  CASE 
    WHEN r.name LIKE '%_solo' OR v.vendor_configuration = 'solo' 
         OR r.config->>'vendorConfiguration' = 'solo'
         OR (r.config->'vendorTypes' @> '["solo"]'::jsonb)
    THEN '✅ Solo Vendor Detected'
    ELSE '❌ Not Detected as Solo'
  END as solo_check,
  
  CASE 
    WHEN (SELECT COUNT(*) FROM vendor_services vs 
          WHERE vs.vendor_id = v.id 
            AND vs.service_style IN ('at_home', 'tele') 
            AND vs.is_enabled = true 
            AND vs.publish_status = 'published') > 0
    THEN '✅ Services Published'
    ELSE '❌ No Published Services'
  END as services_check,
  
  CASE 
    WHEN (SELECT COUNT(*) FROM vendor_availability_v2 va WHERE va.vendor_id = v.id) > 0
      OR (SELECT COUNT(*) FROM vendor_schedule_slots vss 
          WHERE vss.vendor_id = v.id AND vss.is_enabled = true) > 0
    THEN '✅ Schedule Configured'
    ELSE '❌ Schedule NOT Configured'
  END as schedule_check,
  
  -- Final Verdict
  CASE 
    WHEN v.status = 'approved' 
      AND v.is_active = true
      AND (r.name LIKE '%_solo' OR v.vendor_configuration = 'solo' 
           OR r.config->>'vendorConfiguration' = 'solo'
           OR (r.config->'vendorTypes' @> '["solo"]'::jsonb))
      AND (SELECT COUNT(*) FROM vendor_services vs 
           WHERE vs.vendor_id = v.id 
             AND vs.service_style IN ('at_home', 'tele') 
             AND vs.is_enabled = true 
             AND vs.publish_status = 'published') > 0
      AND ((SELECT COUNT(*) FROM vendor_availability_v2 va WHERE va.vendor_id = v.id) > 0
           OR (SELECT COUNT(*) FROM vendor_schedule_slots vss 
               WHERE vss.vendor_id = v.id AND vss.is_enabled = true) > 0)
    THEN '✅ SHOULD APPEAR'
    ELSE '❌ WILL NOT APPEAR - Check failing conditions above'
  END as final_verdict

FROM vendors v
LEFT JOIN roles r ON v.role_id = r.id
WHERE v.phone = '8123456780';

-- ============================================================================
-- Additional: Check Service Details
-- ============================================================================
SELECT 
  vs.id,
  vs.service_name,
  vs.service_style,
  vs.is_enabled,
  vs.publish_status,
  vs.price,
  vs.duration_minutes,
  CASE 
    WHEN vs.is_enabled = true AND vs.publish_status = 'published' 
    THEN '✅ Ready'
    ELSE '❌ Not Ready'
  END as service_status
FROM vendors v
JOIN vendor_services vs ON vs.vendor_id = v.id
WHERE v.phone = '8123456780'
  AND vs.service_style IN ('at_home', 'tele')
ORDER BY vs.service_style, vs.service_name;

-- ============================================================================
-- Additional: Check Schedule Details
-- ============================================================================
-- Check vendor_availability_v2
SELECT 
  'vendor_availability_v2' as schedule_type,
  COUNT(*) as count
FROM vendors v
JOIN vendor_availability_v2 va ON va.vendor_id = v.id
WHERE v.phone = '8123456780'

UNION ALL

-- Check vendor_schedule_slots
SELECT 
  'vendor_schedule_slots' as schedule_type,
  COUNT(*) as count
FROM vendors v
JOIN vendor_schedule_slots vss ON vss.vendor_id = v.id
WHERE v.phone = '8123456780'
  AND vss.is_enabled = true;
