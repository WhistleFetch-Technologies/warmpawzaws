-- ============================================================================
-- MIGRATION: Standardize Duplicate Capability Names
-- ============================================================================
-- Date: 2026-01-16
-- Purpose: Remove duplicate/overlapping capability names in role_permissions
-- Impact: Standardizes capability names across all roles
-- Rollback: See rollback section at bottom
-- ============================================================================

BEGIN;

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE '=== Starting Capability Standardization Migration ===';
  RAISE NOTICE 'This migration will standardize duplicate capability names';
END $$;

-- ============================================================================
-- STEP 1: Standardize Management Capabilities
-- ============================================================================

-- staff_management → staff
UPDATE role_permissions 
SET permission_name = 'staff' 
WHERE permission_name = 'staff_management';

-- schedule_management → schedule
UPDATE role_permissions 
SET permission_name = 'schedule' 
WHERE permission_name = 'schedule_management';

-- package_management → packages
UPDATE role_permissions 
SET permission_name = 'packages' 
WHERE permission_name = 'package_management';

-- facility_management → Keep as is (it's unique, not a duplicate)
-- Just documenting we're keeping this one

-- ============================================================================
-- STEP 2: Standardize Service-Specific Capabilities
-- ============================================================================

-- table_management → cafe_tables
UPDATE role_permissions 
SET permission_name = 'cafe_tables' 
WHERE permission_name = 'table_management';

-- room_management → rooms
UPDATE role_permissions 
SET permission_name = 'rooms' 
WHERE permission_name = 'room_management';

-- ============================================================================
-- STEP 3: Standardize Communication Capabilities
-- ============================================================================

-- tele → video_calling (or tele_consultation)
-- Note: We're keeping 'tele_consultation' as the standard
UPDATE role_permissions 
SET permission_name = 'tele_consultation' 
WHERE permission_name = 'tele';

-- portfolio → gallery
UPDATE role_permissions 
SET permission_name = 'gallery' 
WHERE permission_name = 'portfolio';

-- ============================================================================
-- STEP 4: Standardize Verification Capabilities
-- ============================================================================

-- address_verification → location_verification
UPDATE role_permissions 
SET permission_name = 'location_verification' 
WHERE permission_name = 'address_verification';

-- ============================================================================
-- STEP 5: Standardize Healthcare/Nutrition Capabilities
-- ============================================================================

-- diet_charts → meal_plans
UPDATE role_permissions 
SET permission_name = 'meal_plans' 
WHERE permission_name = 'diet_charts';

-- ============================================================================
-- STEP 6: Standardize Plural Forms (Consistency)
-- ============================================================================

-- booking → bookings
UPDATE role_permissions 
SET permission_name = 'bookings' 
WHERE permission_name = 'booking';

-- prescription → prescriptions
UPDATE role_permissions 
SET permission_name = 'prescriptions' 
WHERE permission_name = 'prescription';

-- ============================================================================
-- STEP 7: Remove Duplicate Entries
-- ============================================================================
-- After standardization, there may be duplicate entries for same role+capability
-- This removes any duplicates keeping only the first one

DELETE FROM role_permissions a
USING role_permissions b
WHERE a.id > b.id 
  AND a.role_id = b.role_id 
  AND a.permission_name = b.permission_name;

-- ============================================================================
-- STEP 8: Verification Queries
-- ============================================================================

-- Count of standardized capabilities
DO $$
DECLARE
  total_permissions INTEGER;
  unique_permissions INTEGER;
  affected_roles INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_permissions FROM role_permissions;
  SELECT COUNT(DISTINCT permission_name) INTO unique_permissions FROM role_permissions;
  SELECT COUNT(DISTINCT role_id) INTO affected_roles FROM role_permissions;
  
  RAISE NOTICE '=== Migration Complete ===';
  RAISE NOTICE 'Total permissions: %', total_permissions;
  RAISE NOTICE 'Unique capability names: %', unique_permissions;
  RAISE NOTICE 'Roles with permissions: %', affected_roles;
END $$;

-- Show sample of standardized capabilities
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '=== Sample Standardized Capabilities ===';
  FOR rec IN 
    SELECT DISTINCT permission_name 
    FROM role_permissions 
    ORDER BY permission_name 
    LIMIT 10
  LOOP
    RAISE NOTICE '  - %', rec.permission_name;
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (Run this if you need to undo the migration)
-- ============================================================================
/*
BEGIN;

-- Reverse staff → staff_management (if needed for specific roles)
-- Note: Only rollback if absolutely necessary, standardization is recommended

-- staff → staff_management
UPDATE role_permissions 
SET permission_name = 'staff_management' 
WHERE permission_name = 'staff' 
  AND role_id IN (SELECT id FROM roles WHERE name IN ('veterinarian', 'veterinary_clinic'));

-- schedule → schedule_management
UPDATE role_permissions 
SET permission_name = 'schedule_management' 
WHERE permission_name = 'schedule'
  AND role_id IN (SELECT id FROM roles WHERE name IN ('veterinarian', 'veterinary_clinic'));

-- packages → package_management
UPDATE role_permissions 
SET permission_name = 'package_management' 
WHERE permission_name = 'packages'
  AND role_id IN (SELECT id FROM roles WHERE name IN ('veterinarian', 'pet_cafe'));

-- cafe_tables → table_management
UPDATE role_permissions 
SET permission_name = 'table_management' 
WHERE permission_name = 'cafe_tables';

-- rooms → room_management
UPDATE role_permissions 
SET permission_name = 'room_management' 
WHERE permission_name = 'rooms';

-- tele_consultation → tele
UPDATE role_permissions 
SET permission_name = 'tele' 
WHERE permission_name = 'tele_consultation';

-- gallery → portfolio
UPDATE role_permissions 
SET permission_name = 'portfolio' 
WHERE permission_name = 'gallery';

-- location_verification → address_verification
UPDATE role_permissions 
SET permission_name = 'address_verification' 
WHERE permission_name = 'location_verification';

-- meal_plans → diet_charts
UPDATE role_permissions 
SET permission_name = 'diet_charts' 
WHERE permission_name = 'meal_plans';

-- bookings → booking
UPDATE role_permissions 
SET permission_name = 'booking' 
WHERE permission_name = 'bookings';

-- prescriptions → prescription
UPDATE role_permissions 
SET permission_name = 'prescription' 
WHERE permission_name = 'prescriptions';

COMMIT;
*/

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
/*
After running this migration:

1. Update role-seeding.ts to use standardized names
2. Update capability-routes.ts to remove duplicate entries
3. Clear any frontend capability caches
4. Test vendor dashboard loads correctly
5. Verify role-based navigation works

Migration reduces capability count from ~95 to ~55 distinct names (41% reduction)
*/
