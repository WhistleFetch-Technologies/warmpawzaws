-- ============================================================================
-- MIGRATION 521: CONSOLIDATE WALKER-RELATED VENDORS TO STANDARD WALKER ROLE
-- ============================================================================
-- Date: 2026-01-31
-- Purpose: Consolidate all walker-related vendors to the single canonical role
--          "walker" (Pet Walker). Migrate vendors from legacy roles (walker_solo,
--          pet_walker, dog_walker) or roles that are no longer available.
-- ============================================================================
-- Canonical role:
--   Role Code: walker
--   Display Name: Pet Walker
--   Description: Standard Pet Walker role
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: ENSURE CANONICAL WALKER ROLE EXISTS
-- ============================================================================

INSERT INTO roles (name, display_name, description, is_system_role, is_active, customer_service, config)
VALUES (
  'walker',
  'Pet Walker',
  'Standard Pet Walker role',
  false,
  true,
  'walker',
  COALESCE(
    (SELECT config FROM roles WHERE name = 'walker' LIMIT 1),
    jsonb_build_object(
      'customer_service', 'walker',
      'vendorConfiguration', 'solo',
      'vendorTypes', ARRAY['solo_provider']::text[],
      'serviceStyles', jsonb_build_object(
        'solo', ARRAY['at_home']::text[],
        'business', ARRAY[]::text[],
        'selected', ARRAY['at_home']::text[]
      ),
      'category', 'service_provider'
    )
  )
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  customer_service = COALESCE(roles.customer_service, EXCLUDED.customer_service),
  config = COALESCE(roles.config, EXCLUDED.config),
  is_active = true,
  updated_at = NOW();

-- ============================================================================
-- STEP 2: MIGRATE VENDORS FROM LEGACY WALKER ROLES TO CANONICAL walker
-- ============================================================================

-- Vendors with role_id pointing to any walker-related role → walker
UPDATE vendors v
SET role_id = (SELECT id FROM roles WHERE name = 'walker' AND is_active = true LIMIT 1),
    updated_at = NOW()
FROM roles r
WHERE v.role_id = r.id
  AND LOWER(r.name) IN ('walker_solo', 'pet_walker', 'dog_walker', 'pet walker', 'dog walker')
  AND (SELECT id FROM roles WHERE name = 'walker' AND is_active = true LIMIT 1) IS NOT NULL;

-- Also handle role names with spaces normalized to underscores
UPDATE vendors v
SET role_id = (SELECT id FROM roles WHERE name = 'walker' AND is_active = true LIMIT 1),
    updated_at = NOW()
FROM roles r
WHERE v.role_id = r.id
  AND LOWER(REPLACE(r.name, ' ', '_')) IN ('walker_solo', 'pet_walker', 'dog_walker')
  AND r.name != 'walker'
  AND (SELECT id FROM roles WHERE name = 'walker' AND is_active = true LIMIT 1) IS NOT NULL;

-- ============================================================================
-- STEP 3: MIGRATE vendor_identity.selected_role_id (if table exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vendor_identity') THEN
    UPDATE vendor_identity vi
    SET selected_role_id = (SELECT id FROM roles WHERE name = 'walker' AND is_active = true LIMIT 1),
        updated_at = NOW()
    FROM roles r
    WHERE vi.selected_role_id = r.id
      AND LOWER(r.name) IN ('walker_solo', 'pet_walker', 'dog_walker')
      AND r.name != 'walker'
      AND (SELECT id FROM roles WHERE name = 'walker' AND is_active = true LIMIT 1) IS NOT NULL;

    UPDATE vendor_identity vi
    SET selected_role_id = (SELECT id FROM roles WHERE name = 'walker' AND is_active = true LIMIT 1),
        updated_at = NOW()
    FROM roles r
    WHERE vi.selected_role_id = r.id
      AND LOWER(REPLACE(r.name, ' ', '_')) IN ('walker_solo', 'pet_walker', 'dog_walker')
      AND r.name != 'walker'
      AND (SELECT id FROM roles WHERE name = 'walker' AND is_active = true LIMIT 1) IS NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- STEP 3b: MIGRATE vendor_onboarding_applications.role_id (if table exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vendor_onboarding_applications') THEN
    UPDATE vendor_onboarding_applications voa
    SET role_id = (SELECT id FROM roles WHERE name = 'walker' AND is_active = true LIMIT 1)
    FROM roles r
    WHERE voa.role_id = r.id
      AND LOWER(r.name) IN ('walker_solo', 'pet_walker', 'dog_walker')
      AND r.name != 'walker'
      AND (SELECT id FROM roles WHERE name = 'walker' AND is_active = true LIMIT 1) IS NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- STEP 4: MARK LEGACY WALKER ROLES AS INACTIVE
-- ============================================================================

UPDATE roles
SET is_active = false,
    updated_at = NOW()
WHERE LOWER(name) IN ('walker_solo', 'pet_walker', 'dog_walker')
   OR (LOWER(REPLACE(name, ' ', '_')) IN ('walker_solo', 'pet_walker', 'dog_walker') AND name != 'walker');

-- ============================================================================
-- STEP 5: ENSURE WALKER ROLE DISPLAY/DESCRIPTION (idempotent)
-- ============================================================================

UPDATE roles
SET display_name = 'Pet Walker',
    description = 'Standard Pet Walker role',
    updated_at = NOW()
WHERE name = 'walker';

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
DECLARE
  walker_role_id UUID;
  vendors_on_walker INTEGER;
  legacy_count INTEGER;
BEGIN
  SELECT id INTO walker_role_id FROM roles WHERE name = 'walker' AND is_active = true LIMIT 1;
  SELECT COUNT(*) INTO vendors_on_walker FROM vendors WHERE role_id = walker_role_id;
  SELECT COUNT(*) INTO legacy_count FROM vendors v
    JOIN roles r ON v.role_id = r.id
    WHERE LOWER(r.name) IN ('walker_solo', 'pet_walker', 'dog_walker');

  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'WALKER ROLE CONSOLIDATION COMPLETE';
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Canonical role: walker (Pet Walker)';
  RAISE NOTICE 'Vendors on walker role: %', vendors_on_walker;
  RAISE NOTICE 'Vendors still on legacy walker roles: % (should be 0)', legacy_count;
  RAISE NOTICE '════════════════════════════════════════════════════════════════';
END $$;
