-- ============================================================================
-- MIGRATION 525: WALKER SERVICE CATALOG DISCOVERY
-- ============================================================================
-- Purpose: Align service_catalog with walker role so vendor service management
--          discovers at_home services for walker (GET /service-catalog/role/:roleId?serviceStyle=at_home).
-- - Ensure applicable_roles for walker services include walker, pet_walker, dog_walker
-- - Insert default walker at_home services if none exist
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Add dog_walker to walker/pet_walker catalog rows (align with roleMappings)
-- ============================================================================
UPDATE service_catalog
SET applicable_roles = array(SELECT DISTINCT unnest(applicable_roles || ARRAY['dog_walker']))
WHERE ('walker' = ANY(applicable_roles) OR 'pet_walker' = ANY(applicable_roles))
  AND status = 'active'
  AND NOT ('dog_walker' = ANY(applicable_roles));

-- ============================================================================
-- STEP 2: Insert default walker at_home services if none exist
-- ============================================================================
INSERT INTO service_catalog (
  service_id,
  service_name,
  display_name,
  description,
  base_price,
  duration_minutes,
  service_style,
  applicable_roles,
  status,
  publish_status,
  display_order
)
SELECT
  'svc_walker_at_home_dog_walk_' || gen_random_uuid(),
  'Dog Walking',
  'Dog Walking',
  'Dog walking service at your location',
  300,
  60,
  'at_home',
  ARRAY['walker', 'pet_walker', 'dog_walker'],
  'active',
  'published',
  0
WHERE NOT EXISTS (
  SELECT 1 FROM service_catalog sc
  WHERE sc.service_style = 'at_home'
    AND (sc.applicable_roles && ARRAY['walker', 'pet_walker']::text[])
    AND sc.status = 'active'
  LIMIT 1
);

-- Optional: add Extended Dog Walk if at least one walker at_home service exists
INSERT INTO service_catalog (
  service_id,
  service_name,
  display_name,
  description,
  base_price,
  duration_minutes,
  service_style,
  applicable_roles,
  status,
  publish_status,
  display_order
)
SELECT
  'svc_walker_at_home_extended_' || gen_random_uuid(),
  'Extended Dog Walk',
  'Extended Dog Walk',
  'Longer duration dog walking at your location',
  500,
  90,
  'at_home',
  ARRAY['walker', 'pet_walker', 'dog_walker'],
  'active',
  'published',
  1
WHERE EXISTS (
  SELECT 1 FROM service_catalog sc
  WHERE sc.service_style = 'at_home'
    AND (sc.applicable_roles && ARRAY['walker', 'pet_walker']::text[])
    AND sc.status = 'active'
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM service_catalog sc2
  WHERE sc2.service_name = 'Extended Dog Walk'
    AND sc2.service_style = 'at_home'
    AND sc2.status = 'active'
  LIMIT 1
);

COMMIT;
