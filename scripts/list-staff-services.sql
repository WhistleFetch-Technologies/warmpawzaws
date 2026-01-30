-- ============================================================================
-- LIST STAFF MEMBERS AND THEIR ENABLED SERVICES FOR AT_HOME AND TELE STYLES
-- ============================================================================
-- This query lists all staff members and their associated enabled services
-- for at_home and tele service styles
-- ============================================================================

-- Query 1: Staff with services (if service_styles column exists in staff_services)
-- Note: Check if this column exists first, if not, use Query 2

SELECT 
    s.id as staff_id,
    s.name as staff_name,
    s.phone,
    s.email,
    s.role,
    s.is_active as staff_active,
    v.id as vendor_id,
    v.business_name,
    v.status as vendor_status,
    ss.service_id,
    srv.name as service_name,
    srv.category as service_category,
    ss.service_styles,
    ss.is_active as service_enabled,
    COALESCE(ss.price, srv.price) as custom_price,
    COALESCE(ss.duration_minutes, srv.duration_minutes) as custom_duration,
    ss.created_at as service_enabled_at
FROM staff s
LEFT JOIN vendors v ON s.vendor_id = v.id
INNER JOIN staff_services ss ON s.id = ss.staff_id
LEFT JOIN services srv ON ss.service_id = srv.id
WHERE 
    s.is_active = true
    AND ss.is_active = true
    AND 'at_home' = ANY(ss.service_styles)  -- Change to 'tele' for tele services
    AND (v.id IS NULL OR (v.status = 'approved' AND v.is_active = true))
ORDER BY 
    v.business_name NULLS LAST,
    s.name,
    srv.name;

-- ============================================================================
-- Query 2: Staff with services via vendor_services (fallback method)
-- Use this if service_styles column doesn't exist in staff_services
-- ============================================================================

SELECT DISTINCT
    s.id as staff_id,
    s.name as staff_name,
    s.phone,
    s.email,
    s.role,
    s.is_active as staff_active,
    v.id as vendor_id,
    v.business_name,
    v.status as vendor_status,
    ss.service_id,
    srv.name as service_name,
    srv.category as service_category,
    vs.service_style,
    ss.is_active as service_enabled,
    COALESCE(ss.price, vs.custom_price, srv.price) as custom_price,
    COALESCE(ss.duration_minutes, vs.custom_duration, srv.duration_minutes) as custom_duration,
    ss.created_at as service_enabled_at
FROM staff s
LEFT JOIN vendors v ON s.vendor_id = v.id
INNER JOIN staff_services ss ON s.id = ss.staff_id
LEFT JOIN services srv ON ss.service_id = srv.id
INNER JOIN vendor_services vs ON vs.vendor_id = COALESCE(s.vendor_id, s.id) AND vs.service_id = ss.service_id
WHERE 
    s.is_active = true
    AND ss.is_active = true
    AND vs.service_style IN ('at_home', 'tele')  -- Change to specific style if needed
    AND vs.is_enabled = true
    AND (v.id IS NULL OR (v.status = 'approved' AND v.is_active = true))
ORDER BY 
    v.business_name NULLS LAST,
    s.name,
    vs.service_style,
    srv.name;

-- ============================================================================
-- Query 3: Summary - Count staff services by style
-- ============================================================================

SELECT 
    s.id as staff_id,
    s.name as staff_name,
    v.business_name,
    COUNT(CASE WHEN vs.service_style = 'at_home' AND vs.is_enabled = true THEN 1 END) as at_home_services,
    COUNT(CASE WHEN vs.service_style = 'tele' AND vs.is_enabled = true THEN 1 END) as tele_services,
    COUNT(CASE WHEN vs.is_enabled = true THEN 1 END) as total_enabled_services
FROM staff s
LEFT JOIN vendors v ON s.vendor_id = v.id
LEFT JOIN staff_services ss ON s.id = ss.staff_id
LEFT JOIN vendor_services vs ON vs.vendor_id = COALESCE(s.vendor_id, s.id) AND vs.service_id = ss.service_id
WHERE 
    s.is_active = true
    AND ss.is_active = true
GROUP BY 
    s.id, s.name, v.business_name
HAVING 
    COUNT(CASE WHEN vs.service_style IN ('at_home', 'tele') AND vs.is_enabled = true THEN 1 END) > 0
ORDER BY 
    v.business_name NULLS LAST,
    s.name;
