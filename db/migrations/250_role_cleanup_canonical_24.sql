-- ============================================================================
-- MIGRATION 250: ROLE CLEANUP - ESTABLISH CANONICAL 24 ROLES
-- ============================================================================
-- Date: 2026-01-21
-- Purpose: Fix role proliferation and establish canonical 24 roles
-- ============================================================================

-- ============================================================================
-- STEP 1: MIGRATE VENDORS FROM ORPHANED ROLES TO CANONICAL ROLES
-- ============================================================================

-- veterinary_clinic (1 vendor) → vet_clinic
UPDATE vendors 
SET role_id = (SELECT id FROM roles WHERE name = 'vet_clinic' LIMIT 1)
WHERE role_id = (SELECT id FROM roles WHERE name = 'veterinary_clinic' LIMIT 1);

-- pet_boarder → boarding (if any vendors)
UPDATE vendors 
SET role_id = (SELECT id FROM roles WHERE name = 'boarding' LIMIT 1)
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_boarder' LIMIT 1);

-- pet_cafe → cafe
UPDATE vendors 
SET role_id = (SELECT id FROM roles WHERE name = 'cafe' LIMIT 1)
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_cafe' LIMIT 1);

-- pet_groomer → groomer_center (default to business)
UPDATE vendors 
SET role_id = (SELECT id FROM roles WHERE name = 'groomer_center' LIMIT 1)
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_groomer' LIMIT 1);

-- pet_trainer → trainer_center
UPDATE vendors 
SET role_id = (SELECT id FROM roles WHERE name = 'trainer_center' LIMIT 1)
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_trainer' LIMIT 1);

-- pet_walker → walker
UPDATE vendors 
SET role_id = (SELECT id FROM roles WHERE name = 'walker' LIMIT 1)
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_walker' LIMIT 1);

-- pet_sitter → sitter
UPDATE vendors 
SET role_id = (SELECT id FROM roles WHERE name = 'sitter' LIMIT 1)
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_sitter' LIMIT 1);

-- pet_photographer → photographer
UPDATE vendors 
SET role_id = (SELECT id FROM roles WHERE name = 'photographer' LIMIT 1)
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_photographer' LIMIT 1);

-- pet_pharmacy → pharmacy
UPDATE vendors 
SET role_id = (SELECT id FROM roles WHERE name = 'pharmacy' LIMIT 1)
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_pharmacy' LIMIT 1);

-- pet_ambulance → ambulance
UPDATE vendors 
SET role_id = (SELECT id FROM roles WHERE name = 'ambulance' LIMIT 1)
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_ambulance' LIMIT 1);

-- pet_resort → resort
UPDATE vendors 
SET role_id = (SELECT id FROM roles WHERE name = 'resort' LIMIT 1)
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_resort' LIMIT 1);

-- pet_breeder → breeder
UPDATE vendors 
SET role_id = (SELECT id FROM roles WHERE name = 'breeder' LIMIT 1)
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_breeder' LIMIT 1);

-- pet_sunset_services → sunset
UPDATE vendors 
SET role_id = (SELECT id FROM roles WHERE name = 'sunset' LIMIT 1)
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_sunset_services' LIMIT 1);

-- pet_shelter → adoption_center
UPDATE vendors 
SET role_id = (SELECT id FROM roles WHERE name = 'adoption_center' LIMIT 1)
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_shelter' LIMIT 1);

-- pet_products_store → seller
UPDATE vendors 
SET role_id = (SELECT id FROM roles WHERE name = 'seller' LIMIT 1)
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_products_store' LIMIT 1);

-- pet_taxi → relocation
UPDATE vendors 
SET role_id = (SELECT id FROM roles WHERE name = 'relocation' LIMIT 1)
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_taxi' LIMIT 1);

-- pet_boarding → boarding
UPDATE vendors 
SET role_id = (SELECT id FROM roles WHERE name = 'boarding' LIMIT 1)
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_boarding' LIMIT 1);

-- pet_behaviorist → trainer_solo
UPDATE vendors 
SET role_id = (SELECT id FROM roles WHERE name = 'trainer_solo' LIMIT 1)
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_behaviorist' LIMIT 1);

-- Also migrate vendor_identity references
UPDATE vendor_identity 
SET selected_role_id = (SELECT id FROM roles WHERE name = 'vet_clinic' LIMIT 1)
WHERE selected_role_id = (SELECT id FROM roles WHERE name = 'veterinary_clinic' LIMIT 1);

-- ============================================================================
-- STEP 2: RENAME veterinarian TO vet_solo
-- ============================================================================

UPDATE roles SET
  name = 'vet_solo',
  display_name = 'Veterinarian (Solo)',
  customer_service = 'vet',
  config = '{"customer_service": "vet", "vendorConfiguration": "solo", "vendorTypes": ["solo"], "serviceStyles": {"solo": ["at_home", "tele"], "business": [], "selected": ["at_home", "tele"]}, "category": "healthcare"}'::jsonb,
  updated_at = NOW()
WHERE name = 'veterinarian';

-- ============================================================================
-- STEP 3: CREATE nutritionist_center IF NOT EXISTS
-- ============================================================================
INSERT INTO roles (name, display_name, description, is_system_role, is_active, customer_service, config)
VALUES (
  'nutritionist_center',
  'Nutritionist (Center)',
  'Pet nutrition center with multiple staff',
  false,
  true,
  'nutritionist',
  '{"customer_service": "nutritionist", "vendorConfiguration": "business", "vendorTypes": ["center", "business"], "serviceStyles": {"solo": [], "business": ["at_center", "at_home", "tele"], "selected": ["at_center", "tele"]}, "category": "healthcare"}'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  customer_service = EXCLUDED.customer_service,
  config = EXCLUDED.config,
  is_active = true,
  updated_at = NOW();

-- ============================================================================
-- STEP 4: FIX MISSING customer_service AND vendorConfiguration
-- ============================================================================

-- nutritionist (solo)
UPDATE roles SET
  customer_service = 'nutritionist',
  config = jsonb_set(
    jsonb_set(
      COALESCE(config, '{}'::jsonb),
      '{customer_service}', '"nutritionist"'::jsonb
    ),
    '{vendorConfiguration}', '"solo"'::jsonb
  ),
  updated_at = NOW()
WHERE name = 'nutritionist';

-- insurance (business)
UPDATE roles SET
  customer_service = 'insurance',
  config = jsonb_set(
    jsonb_set(
      COALESCE(config, '{}'::jsonb),
      '{customer_service}', '"insurance"'::jsonb
    ),
    '{vendorConfiguration}', '"business"'::jsonb
  ),
  updated_at = NOW()
WHERE name = 'insurance';

-- diagnostics_center (use vet since diagnostics not in allowed list)
UPDATE roles SET
  customer_service = 'vet',
  config = jsonb_set(
    jsonb_set(
      COALESCE(config, '{}'::jsonb),
      '{customer_service}', '"vet"'::jsonb
    ),
    '{vendorConfiguration}', '"business"'::jsonb
  ),
  updated_at = NOW()
WHERE name = 'diagnostics_center';

-- event_organizer (set vendorConfiguration only, keep customer_service NULL)
UPDATE roles SET
  config = jsonb_set(
    COALESCE(config, '{}'::jsonb),
    '{vendorConfiguration}', '"business"'::jsonb
  ),
  updated_at = NOW()
WHERE name = 'event_organizer';

-- pet_boarder (will be deactivated, but fix first)
UPDATE roles SET
  customer_service = 'boarding',
  config = jsonb_set(
    jsonb_set(
      COALESCE(config, '{}'::jsonb),
      '{customer_service}', '"boarding"'::jsonb
    ),
    '{vendorConfiguration}', '"business"'::jsonb
  ),
  updated_at = NOW()
WHERE name = 'pet_boarder';

-- ============================================================================
-- STEP 5: DEACTIVATE ALL NON-CANONICAL ROLES
-- ============================================================================

UPDATE roles SET
  is_active = false,
  updated_at = NOW()
WHERE name NOT IN (
  'vet_solo',
  'vet_clinic',
  'groomer_solo',
  'groomer_center',
  'trainer_solo',
  'trainer_center',
  'boarding',
  'walker',
  'sitter',
  'adoption_center',
  'cafe',
  'photographer',
  'pharmacy',
  'seller',
  'ambulance',
  'insurance',
  'nutritionist',
  'nutritionist_center',
  'relocation',
  'resort',
  'holiday',
  'sunset',
  'breeder',
  'diagnostics_center',
  'event_organizer'
);

-- ============================================================================
-- STEP 6: DELETE role_permissions FOR INACTIVE ROLES
-- ============================================================================
DELETE FROM role_permissions
WHERE role_id IN (
  SELECT id FROM roles WHERE is_active = false
);

-- ============================================================================
-- STEP 7: ADD staff_create CAPABILITY TO ALL BUSINESS ROLES
-- ============================================================================
-- This ensures all business roles can create staff

INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, 'staff_create', '*', '*'
FROM roles r
WHERE r.is_active = true
  AND r.config->>'vendorConfiguration' = 'business'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_name = 'staff_create'
  );

INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, 'staff_management', '*', '*'
FROM roles r
WHERE r.is_active = true
  AND r.config->>'vendorConfiguration' = 'business'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_name = 'staff_management'
  );

INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, 'staff_schedule', '*', '*'
FROM roles r
WHERE r.is_active = true
  AND r.config->>'vendorConfiguration' = 'business'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_name = 'staff_schedule'
  );

-- ============================================================================
-- STEP 8: ADD BASE CAPABILITIES TO ALL ACTIVE ROLES
-- ============================================================================

-- Ensure all active roles have basic capabilities
INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap, '*', '*'
FROM roles r
CROSS JOIN unnest(ARRAY[
  'dashboard', 'profile', 'chat', 'notifications', 
  'bookings', 'earnings', 'settlements', 'bank_account',
  'schedule', 'service_pricing', 'booking_create', 'booking_view', 'pricing'
]) AS cap
WHERE r.is_active = true
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
DECLARE
  active_count INTEGER;
  inactive_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO active_count FROM roles WHERE is_active = true;
  SELECT COUNT(*) INTO inactive_count FROM roles WHERE is_active = false;
  
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'ROLE CLEANUP COMPLETE';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Active Roles: % (should be ~25)', active_count;
  RAISE NOTICE 'Inactive Roles: %', inactive_count;
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
END $$;
