-- ============================================================================
-- LIST SOLO VENDORS AND THEIR ENABLED SERVICES
-- ============================================================================
-- This query lists all solo vendors and their associated enabled services
-- Run this query in your database to see all solo vendors and their services
-- ============================================================================

SELECT 
    v.id as vendor_id,
    v.business_name,
    v.owner_name,
    v.phone,
    v.email,
    v.status as vendor_status,
    v.is_active,
    vi.vendor_type,
    r.name as role_name,
    r.display_name as role_display_name,
    vs.service_id,
    s.name as service_name,
    s.category as service_category,
    vs.service_style,
    vs.is_enabled,
    vs.custom_price,
    vs.custom_duration,
    vs.publish_status,
    vs.created_at as service_enabled_at
FROM vendors v
LEFT JOIN vendor_identity vi ON v.id = vi.vendor_id
LEFT JOIN roles r ON vi.selected_role_id = r.id
INNER JOIN vendor_services vs ON v.id = vs.vendor_id
LEFT JOIN service_catalog s ON vs.service_id = s.id
WHERE 
    (vi.vendor_type = 'solo' OR v.vendor_configuration = 'solo')
    AND vs.is_enabled = true
ORDER BY 
    v.business_name, 
    vs.service_style,
    s.name;

-- ============================================================================
-- SUMMARY QUERY: Count services by style for each solo vendor
-- ============================================================================

SELECT 
    v.id as vendor_id,
    v.business_name,
    v.owner_name,
    v.phone,
    r.display_name as role_name,
    COUNT(CASE WHEN vs.service_style = 'at_home' AND vs.is_enabled = true THEN 1 END) as at_home_services,
    COUNT(CASE WHEN vs.service_style = 'tele' AND vs.is_enabled = true THEN 1 END) as tele_services,
    COUNT(CASE WHEN vs.service_style = 'at_center' AND vs.is_enabled = true THEN 1 END) as at_center_services,
    COUNT(CASE WHEN vs.is_enabled = true THEN 1 END) as total_enabled_services
FROM vendors v
LEFT JOIN vendor_identity vi ON v.id = vi.vendor_id
LEFT JOIN roles r ON vi.selected_role_id = r.id
LEFT JOIN vendor_services vs ON v.id = vs.vendor_id
WHERE 
    (vi.vendor_type = 'solo' OR v.vendor_configuration = 'solo')
GROUP BY 
    v.id, v.business_name, v.owner_name, v.phone, r.display_name
ORDER BY 
    v.business_name;

-- ============================================================================
-- DETAILED VIEW: All service information grouped by vendor
-- ============================================================================

SELECT 
    v.id as vendor_id,
    v.business_name,
    v.owner_name,
    v.phone,
    v.email,
    v.status,
    r.display_name as role_name,
    vs.service_style,
    COUNT(*) as service_count,
    STRING_AGG(DISTINCT s.name, ', ' ORDER BY s.name) as service_names,
    STRING_AGG(DISTINCT s.category, ', ' ORDER BY s.category) as categories
FROM vendors v
LEFT JOIN vendor_identity vi ON v.id = vi.vendor_id
LEFT JOIN roles r ON vi.selected_role_id = r.id
INNER JOIN vendor_services vs ON v.id = vs.vendor_id
LEFT JOIN service_catalog s ON vs.service_id = s.id
WHERE 
    (vi.vendor_type = 'solo' OR v.vendor_configuration = 'solo')
    AND vs.is_enabled = true
GROUP BY 
    v.id, v.business_name, v.owner_name, v.phone, v.email, v.status, r.display_name, vs.service_style
ORDER BY 
    v.business_name, vs.service_style;
