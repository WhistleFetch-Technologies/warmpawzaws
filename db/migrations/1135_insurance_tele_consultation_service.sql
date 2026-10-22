-- One tele service for every insurance provider.
-- Archives the two older catalogue plans and enables Tele Consultation.

INSERT INTO service_catalog (
  service_id, service_name, display_name, description,
  category_id, category_name, applicable_roles, service_style,
  base_price, duration_minutes, status, publish_status, display_order
) VALUES (
  'insurance_tele_consultation',
  'Tele Consultation',
  'Tele Consultation',
  'Video consultation with an insurance advisor',
  'specialty',
  'Specialty Services',
  ARRAY['pet_insurance', 'insurance'],
  'tele',
  0,
  30,
  'active',
  'published',
  1
)
ON CONFLICT (service_id) DO UPDATE SET
  service_name = EXCLUDED.service_name,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  applicable_roles = EXCLUDED.applicable_roles,
  service_style = EXCLUDED.service_style,
  status = 'active',
  publish_status = 'published';

UPDATE service_catalog
SET status = 'archived', publish_status = 'archived', updated_at = NOW()
WHERE service_id IN ('insurance_basic', 'insurance_premium')
  AND status IS DISTINCT FROM 'archived';

UPDATE vendor_services vs
SET is_enabled = false, publish_status = 'draft', updated_at = NOW()
FROM service_catalog sc
WHERE vs.service_id = sc.id
  AND sc.service_id IN ('insurance_basic', 'insurance_premium')
  AND vs.is_enabled = true;

INSERT INTO vendor_services (
  vendor_id, service_id, service_name, category, price, duration_minutes,
  service_style, is_enabled, publish_status, is_custom_service
)
SELECT DISTINCT v.id, sc.id, 'Tele Consultation', 'specialty', 0, 30, 'tele', true, 'published', false
FROM vendors v
JOIN service_catalog sc ON sc.service_id = 'insurance_tele_consultation'
WHERE (
  EXISTS (
    SELECT 1 FROM roles r
    WHERE r.id = v.role_id AND r.name IN ('insurance', 'pet_insurance')
  )
  OR EXISTS (
    SELECT 1
    FROM vendor_services old
    JOIN service_catalog oldc ON oldc.id = old.service_id
    WHERE old.vendor_id = v.id
      AND oldc.service_id IN ('insurance_basic', 'insurance_premium')
  )
)
AND NOT EXISTS (
  SELECT 1 FROM vendor_services existing
  WHERE existing.vendor_id = v.id
    AND existing.service_id = sc.id
    AND existing.service_style = 'tele'
);

UPDATE vendor_services vs
SET is_enabled = true, publish_status = 'published', service_name = 'Tele Consultation', updated_at = NOW()
FROM service_catalog sc
WHERE vs.service_id = sc.id
  AND sc.service_id = 'insurance_tele_consultation'
  AND vs.service_style = 'tele'
  AND (vs.is_enabled IS DISTINCT FROM true OR vs.publish_status IS DISTINCT FROM 'published');
