-- List Groomer and Trainer Vendors with Their Services
-- This query lists all active groomer and trainer vendors with their enabled services,
-- packages, and custom services

-- First, get all groomer/trainer vendors
WITH vendor_list AS (
  SELECT 
    v.id as vendor_id,
    v.business_name,
    v.owner_name,
    v.phone,
    v.email,
    v.vendor_type,
    v.is_active,
    v.vendor_configuration,
    r.id as role_id,
    r.name as role_name,
    r.display_name as role_display_name
  FROM vendors v
  LEFT JOIN roles r ON v.role_id = r.id
  WHERE 
    (r.name ILIKE '%groomer%' OR r.name ILIKE '%trainer%' OR r.name ILIKE '%pet_groomer%' OR r.name ILIKE '%pet_trainer%')
    AND v.is_active = true
)
SELECT 
  vl.vendor_id,
  vl.business_name,
  vl.owner_name,
  vl.phone,
  vl.role_name,
  vl.role_display_name,
  vl.vendor_type,
  vl.vendor_configuration,
  -- Service details
  vs.id as vendor_service_id,
  vs.service_name,
  vs.service_style,
  vs.category,
  vs.sub_category,
  vs.price,
  vs.custom_price,
  vs.duration_minutes,
  vs.custom_duration,
  vs.is_enabled,
  vs.publish_status,
  vs.is_custom_service,
  vs.metadata,
  -- Catalog service info
  sc.service_name as catalog_service_name,
  sc.is_package as catalog_is_package,
  sc.service_style as catalog_service_style
FROM vendor_list vl
LEFT JOIN vendor_services vs ON vl.vendor_id = vs.vendor_id
LEFT JOIN service_catalog sc ON vs.service_id = sc.id OR vs.catalog_service_id = sc.id
ORDER BY 
  vl.role_name,
  vl.business_name,
  vs.service_style,
  vs.service_name;
