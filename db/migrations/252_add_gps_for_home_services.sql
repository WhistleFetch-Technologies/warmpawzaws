-- ============================================================================
-- MIGRATION 252: ADD GPS TRACKING FOR HOME SERVICES
-- ============================================================================
-- Date: 2026-01-21
-- Purpose: Add GPS tracking capabilities to roles that provide home services
-- - vet_solo: Home visit veterinary services
-- - vet_clinic: Staff doing home visits
-- - groomer_solo: Home grooming services
-- - groomer_center: Staff doing home grooming
-- ============================================================================

BEGIN;

-- ============================================================================
-- ADD GPS CAPABILITIES TO VET ROLES
-- ============================================================================

-- vet_solo - for home visits
INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('gps_tracking'),
    ('live_location'),
    ('photo_updates')
) AS cap(name)
WHERE r.is_active = true AND r.name = 'vet_solo'
ON CONFLICT DO NOTHING;

-- vet_clinic - staff doing home visits
INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('gps_tracking'),
    ('live_location'),
    ('photo_updates')
) AS cap(name)
WHERE r.is_active = true AND r.name = 'vet_clinic'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ADD GPS CAPABILITIES TO GROOMER ROLES
-- ============================================================================

-- groomer_solo - for home grooming
INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('gps_tracking'),
    ('live_location'),
    ('photo_updates')
) AS cap(name)
WHERE r.is_active = true AND r.name = 'groomer_solo'
ON CONFLICT DO NOTHING;

-- groomer_center - staff doing home grooming
INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('gps_tracking'),
    ('live_location'),
    ('photo_updates')
) AS cap(name)
WHERE r.is_active = true AND r.name = 'groomer_center'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ALSO ADD TO TRAINER ROLES (they also do home training)
-- ============================================================================

-- trainer_solo - for home training sessions
INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('gps_tracking'),
    ('live_location'),
    ('photo_updates')
) AS cap(name)
WHERE r.is_active = true AND r.name = 'trainer_solo'
ON CONFLICT DO NOTHING;

-- trainer_center - staff doing home training
INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('gps_tracking'),
    ('live_location'),
    ('photo_updates')
) AS cap(name)
WHERE r.is_active = true AND r.name = 'trainer_center'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  role_record RECORD;
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'GPS CAPABILITIES ADDED FOR HOME SERVICES';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  
  FOR role_record IN 
    SELECT r.name, array_agg(rp.permission_name ORDER BY rp.permission_name) as gps_caps
    FROM roles r
    JOIN role_permissions rp ON r.id = rp.role_id
    WHERE r.is_active = true
      AND r.name IN ('vet_solo', 'vet_clinic', 'groomer_solo', 'groomer_center', 'trainer_solo', 'trainer_center')
      AND rp.permission_name IN ('gps_tracking', 'live_location', 'photo_updates')
    GROUP BY r.name
    ORDER BY r.name
  LOOP
    RAISE NOTICE '✅ %: %', role_record.name, role_record.gps_caps;
  END LOOP;
  
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
END $$;

COMMIT;
