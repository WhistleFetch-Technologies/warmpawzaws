-- ============================================================================
-- MIGRATION 251: ROLE CAPABILITY CLEANUP
-- ============================================================================
-- Date: 2026-01-21
-- Purpose: Clean up and correctly assign capabilities to each role
-- - Remove all existing permissions
-- - Re-assign base capabilities (common to all)
-- - Re-assign role-specific capabilities
-- - Ensure no role has capabilities it shouldn't have
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: DELETE ALL EXISTING PERMISSIONS FOR ACTIVE ROLES
-- ============================================================================
-- Start fresh with correct assignments

DELETE FROM role_permissions
WHERE role_id IN (SELECT id FROM roles WHERE is_active = true);

-- ============================================================================
-- STEP 2: INSERT BASE CAPABILITIES FOR ALL ACTIVE ROLES
-- ============================================================================
-- These are common to ALL vendor roles

INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('dashboard'),
    ('profile'),
    ('chat'),
    ('notifications'),
    ('bookings'),
    ('booking_create'),
    ('booking_view'),
    ('earnings'),
    ('settlements'),
    ('bank_account'),
    ('schedule'),
    ('service_pricing'),
    ('pricing')
) AS cap(name)
WHERE r.is_active = true;

-- ============================================================================
-- STEP 3: ADD STAFF CAPABILITIES TO BUSINESS ROLES ONLY
-- ============================================================================

INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('staff_management'),
    ('staff_create'),
    ('staff_schedule'),
    ('facility_management'),
    ('center_profile'),
    ('custom_services'),
    ('custom_packages')
) AS cap(name)
WHERE r.is_active = true
  AND r.config->>'vendorConfiguration' = 'business';

-- ============================================================================
-- STEP 4: ADD SOLO-SPECIFIC CAPABILITIES
-- ============================================================================

INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('professional_profile'),
    ('platform_catalog_services')
) AS cap(name)
WHERE r.is_active = true
  AND r.config->>'vendorConfiguration' = 'solo';

-- ============================================================================
-- STEP 5: ADD VET-SPECIFIC CAPABILITIES
-- ============================================================================

-- Vet Solo capabilities
INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('prescription_create'),
    ('prescriptions'),
    ('medical_records'),
    ('diagnostic_results'),
    ('diagnostics'),
    ('patient_monitoring'),
    ('tele'),
    ('video_calling'),
    ('emergency'),
    ('vet_summary')
) AS cap(name)
WHERE r.is_active = true AND r.name = 'vet_solo';

-- Vet Clinic capabilities
INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('prescription_create'),
    ('prescriptions'),
    ('medical_records'),
    ('diagnostic_results'),
    ('diagnostics'),
    ('patient_monitoring'),
    ('tele'),
    ('video_calling'),
    ('emergency'),
    ('vet_summary'),
    ('cctv_access'),
    ('multi_doctor_management'),
    ('inventory'),
    ('inventory_manage')
) AS cap(name)
WHERE r.is_active = true AND r.name = 'vet_clinic';

-- Diagnostics Center capabilities
INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('diagnostic_results'),
    ('diagnostics'),
    ('diagnostic_lab'),
    ('vet_summary')
) AS cap(name)
WHERE r.is_active = true AND r.name = 'diagnostics_center';

-- ============================================================================
-- STEP 6: ADD GROOMING-SPECIFIC CAPABILITIES
-- ============================================================================

INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('gallery'),
    ('portfolio')
) AS cap(name)
WHERE r.is_active = true AND r.name IN ('groomer_solo', 'groomer_center');

-- ============================================================================
-- STEP 7: ADD TRAINING-SPECIFIC CAPABILITIES
-- ============================================================================

INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('training_programs'),
    ('progress_tracking')
) AS cap(name)
WHERE r.is_active = true AND r.name IN ('trainer_solo', 'trainer_center');

-- ============================================================================
-- STEP 8: ADD BOARDING/RESORT/HOLIDAY CAPABILITIES
-- ============================================================================

INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('rooms'),
    ('room_management'),
    ('cctv_access'),
    ('occupancy_tracking'),
    ('nightly_pricing')
) AS cap(name)
WHERE r.is_active = true AND r.name IN ('boarding', 'resort', 'holiday');

-- Resort and Holiday get events capability too
INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, 'events', '*', '*'
FROM roles r
WHERE r.is_active = true AND r.name IN ('resort', 'holiday');

-- ============================================================================
-- STEP 9: ADD WALKER/SITTER CAPABILITIES
-- ============================================================================

INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('gps_tracking'),
    ('live_location'),
    ('photo_updates')
) AS cap(name)
WHERE r.is_active = true AND r.name IN ('walker', 'sitter');

-- Walker gets walking capability
INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, 'walking', '*', '*'
FROM roles r
WHERE r.is_active = true AND r.name = 'walker';

-- ============================================================================
-- STEP 10: ADD CAFE CAPABILITIES
-- ============================================================================

INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('cafe_tables'),
    ('table_management'),
    ('menu'),
    ('pax_management'),
    ('inventory'),
    ('inventory_manage')
) AS cap(name)
WHERE r.is_active = true AND r.name = 'cafe';

-- ============================================================================
-- STEP 11: ADD PHARMACY CAPABILITIES
-- ============================================================================

INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('inventory'),
    ('inventory_manage'),
    ('catalog'),
    ('product_catalog'),
    ('orders'),
    ('delivery'),
    ('prescription_verification'),
    ('controlled_substances'),
    ('expiry_management'),
    ('order_dispatch'),
    ('order_broadcast'),
    ('availability_check')
) AS cap(name)
WHERE r.is_active = true AND r.name = 'pharmacy';

-- ============================================================================
-- STEP 12: ADD SELLER CAPABILITIES
-- ============================================================================

INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('inventory'),
    ('inventory_manage'),
    ('catalog'),
    ('product_catalog'),
    ('orders'),
    ('delivery'),
    ('order_dispatch'),
    ('order_broadcast')
) AS cap(name)
WHERE r.is_active = true AND r.name = 'seller';

-- ============================================================================
-- STEP 13: ADD AMBULANCE CAPABILITIES
-- ============================================================================

INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('gps_tracking'),
    ('live_location'),
    ('emergency'),
    ('emergency_protocols'),
    ('ambulance'),
    ('ambulance_services'),
    ('distance_pricing')
) AS cap(name)
WHERE r.is_active = true AND r.name = 'ambulance';

-- ============================================================================
-- STEP 14: ADD INSURANCE CAPABILITIES
-- ============================================================================

INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('insurance_plans'),
    ('policy_management'),
    ('claims_management'),
    ('tele'),
    ('video_calling')
) AS cap(name)
WHERE r.is_active = true AND r.name = 'insurance';

-- ============================================================================
-- STEP 15: ADD NUTRITIONIST CAPABILITIES
-- ============================================================================

-- Nutritionist (solo)
INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('meal_plans'),
    ('diet_charts'),
    ('progress_tracking'),
    ('tele'),
    ('video_calling')
) AS cap(name)
WHERE r.is_active = true AND r.name = 'nutritionist';

-- Nutritionist Center (business)
INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('meal_plans'),
    ('diet_charts'),
    ('progress_tracking')
) AS cap(name)
WHERE r.is_active = true AND r.name = 'nutritionist_center';

-- ============================================================================
-- STEP 16: ADD ADOPTION CENTER CAPABILITIES
-- ============================================================================

INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('adoption'),
    ('pet_profiles'),
    ('donation'),
    ('events')
) AS cap(name)
WHERE r.is_active = true AND r.name = 'adoption_center';

-- ============================================================================
-- STEP 17: ADD BREEDER CAPABILITIES
-- ============================================================================

INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('pet_profiles'),
    ('gallery')
) AS cap(name)
WHERE r.is_active = true AND r.name = 'breeder';

-- ============================================================================
-- STEP 18: ADD SUNSET CAPABILITIES
-- ============================================================================

INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('memorial'),
    ('counseling')
) AS cap(name)
WHERE r.is_active = true AND r.name = 'sunset';

-- ============================================================================
-- STEP 19: ADD RELOCATION CAPABILITIES
-- ============================================================================

INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('gps_tracking'),
    ('live_location'),
    ('distance_pricing')
) AS cap(name)
WHERE r.is_active = true AND r.name = 'relocation';

-- ============================================================================
-- STEP 20: ADD PHOTOGRAPHER CAPABILITIES
-- ============================================================================

INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('gallery'),
    ('portfolio')
) AS cap(name)
WHERE r.is_active = true AND r.name = 'photographer';

-- ============================================================================
-- STEP 21: ADD EVENT ORGANIZER CAPABILITIES
-- ============================================================================

INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap.name, '*', '*'
FROM roles r
CROSS JOIN (
  VALUES 
    ('events'),
    ('pax_management')
) AS cap(name)
WHERE r.is_active = true AND r.name = 'event_organizer';

-- Note: event_organizer doesn't have a matching customer_service in constraint
-- Leave it as NULL for now (constraint allows NULL)

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  role_record RECORD;
  perm_count INTEGER;
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'CAPABILITY CLEANUP COMPLETE - VERIFICATION';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  
  FOR role_record IN 
    SELECT r.name, r.config->>'vendorConfiguration' as vendor_config, COUNT(rp.id) as perm_count
    FROM roles r
    LEFT JOIN role_permissions rp ON r.id = rp.role_id
    WHERE r.is_active = true
    GROUP BY r.id, r.name, r.config
    ORDER BY r.name
  LOOP
    RAISE NOTICE '% (%) → % permissions', role_record.name, COALESCE(role_record.vendor_config, 'N/A'), role_record.perm_count;
  END LOOP;
  
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
END $$;

COMMIT;
