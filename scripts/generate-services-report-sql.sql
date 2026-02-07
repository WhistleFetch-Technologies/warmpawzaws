-- SQL Query to Generate Services Report
-- This query generates a comprehensive report of all services with prices, UI locations, and enabled vendors

-- Main Services Report Query
SELECT 
    -- Service Information
    s.id AS service_id,
    s.name AS service_name,
    s.description AS service_description,
    s.category AS service_category,
    s.base_price AS base_price,
    s.duration_minutes AS base_duration,
    s.is_global AS is_global_service,
    s.is_active AS service_active,
    
    -- Vendor Service Information
    vs.id AS vendor_service_id,
    vs.vendor_id,
    vs.custom_price AS vendor_price,
    vs.custom_duration AS vendor_duration,
    vs.service_style,
    vs.is_enabled AS vendor_service_enabled,
    vs.publish_status,
    
    -- Vendor Information
    v.business_name AS vendor_name,
    v.status AS vendor_status,
    v.is_active AS vendor_active,
    v.city AS vendor_city,
    v.state AS vendor_state,
    
    -- Role Information
    r.name AS role_name,
    r.display_name AS role_display_name,
    
    -- Final Price and Duration (vendor override or base)
    COALESCE(vs.custom_price, s.base_price, 0) AS final_price,
    COALESCE(vs.custom_duration, s.duration_minutes, 30) AS final_duration,
    
    -- Service Style Display
    CASE vs.service_style
        WHEN 'at_home' THEN 'Home Visit'
        WHEN 'at_center' THEN 'At Center/Clinic'
        WHEN 'tele' THEN 'Teleconsultation'
        ELSE vs.service_style
    END AS service_style_display

FROM services s
LEFT JOIN vendor_services vs ON s.id = vs.service_id
LEFT JOIN vendors v ON vs.vendor_id = v.id
LEFT JOIN roles r ON v.role_id = r.id

WHERE 
    -- Only active services
    s.is_active = true
    
    -- Only approved and active vendors
    AND (v.id IS NULL OR (v.status = 'approved' AND v.is_active = true))
    
    -- Only enabled and published vendor services (or global services)
    AND (
        (vs.id IS NULL AND s.is_global = true) OR
        (vs.is_enabled = true AND vs.publish_status IN ('published', 'auto_published'))
    )

ORDER BY 
    s.category,
    s.name,
    v.business_name,
    vs.service_style;

-- Summary Query: Services by Category
SELECT 
    s.category,
    COUNT(DISTINCT s.id) AS total_services,
    COUNT(DISTINCT vs.vendor_id) AS vendors_offering,
    MIN(COALESCE(vs.custom_price, s.base_price, 0)) AS min_price,
    MAX(COALESCE(vs.custom_price, s.base_price, 0)) AS max_price,
    AVG(COALESCE(vs.custom_price, s.base_price, 0)) AS avg_price
FROM services s
LEFT JOIN vendor_services vs ON s.id = vs.service_id
LEFT JOIN vendors v ON vs.vendor_id = v.id
WHERE s.is_active = true
    AND (v.id IS NULL OR (v.status = 'approved' AND v.is_active = true))
    AND (
        (vs.id IS NULL AND s.is_global = true) OR
        (vs.is_enabled = true AND vs.publish_status IN ('published', 'auto_published'))
    )
GROUP BY s.category
ORDER BY s.category;

-- Summary Query: Services by Style
SELECT 
    vs.service_style,
    COUNT(DISTINCT vs.id) AS service_count,
    COUNT(DISTINCT vs.vendor_id) AS vendor_count
FROM vendor_services vs
JOIN vendors v ON vs.vendor_id = v.id
WHERE vs.is_enabled = true
    AND vs.publish_status IN ('published', 'auto_published')
    AND v.status = 'approved'
    AND v.is_active = true
GROUP BY vs.service_style
ORDER BY vs.service_style;

-- Vendor Services Count
SELECT 
    v.business_name,
    r.display_name AS role_name,
    COUNT(DISTINCT vs.id) AS total_services,
    COUNT(DISTINCT CASE WHEN vs.service_style = 'at_home' THEN vs.id END) AS at_home_count,
    COUNT(DISTINCT CASE WHEN vs.service_style = 'at_center' THEN vs.id END) AS at_center_count,
    COUNT(DISTINCT CASE WHEN vs.service_style = 'tele' THEN vs.id END) AS tele_count
FROM vendors v
JOIN roles r ON v.role_id = r.id
LEFT JOIN vendor_services vs ON v.id = vs.vendor_id
    AND vs.is_enabled = true
    AND vs.publish_status IN ('published', 'auto_published')
WHERE v.status = 'approved'
    AND v.is_active = true
GROUP BY v.id, v.business_name, r.display_name
ORDER BY total_services DESC;
