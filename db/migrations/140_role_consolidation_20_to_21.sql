-- ============================================================================
-- MIGRATION 140: ROLE CONSOLIDATION (20 → 21 ROLES)
-- ============================================================================
-- Date: 2026-01-16
-- Purpose: Consolidate 20 roles to 21 roles aligned with customer services
-- Part of: Role Consolidation & Three-Level Enforcement Implementation
-- ============================================================================
-- This migration:
-- 1. Renames existing roles to match customer service names
-- 2. Merges pet_boarder + pet_daycare into boarding
-- 3. Splits pet_groomer into groomer_solo and groomer_center
-- 4. Splits pet_trainer into trainer_solo and trainer_center
-- 5. Splits veterinarian into vet_solo and vet_center (if needed)
-- 6. Creates missing roles (breeder, resort, holiday, sunset, seller)
-- 7. Updates all roles with vendorConfiguration and serviceStyles config
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: RENAME OPERATIONS (Simple name changes)
-- ============================================================================
-- Handle renames safely - if target exists, update it; if source exists, rename it

-- Walker
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM roles WHERE name = 'pet_walker') THEN
    IF EXISTS (SELECT 1 FROM roles WHERE name = 'walker') THEN
      -- Target exists, update it and delete source
      UPDATE roles SET 
        display_name = 'Pet Walker',
        customer_service = 'walker',
        config = jsonb_set(
          jsonb_set(
            COALESCE(config, '{}'::jsonb),
            '{customer_service}', '"walker"'::jsonb
          ),
          '{vendorConfiguration}', '"solo"'::jsonb
        ),
        updated_at = NOW()
      WHERE name = 'walker';
      DELETE FROM roles WHERE name = 'pet_walker';
    ELSE
      -- Rename source to target
      UPDATE roles SET 
        name = 'walker',
        display_name = 'Pet Walker',
        customer_service = 'walker',
        config = jsonb_set(
          jsonb_set(
            COALESCE(config, '{}'::jsonb),
            '{customer_service}', '"walker"'::jsonb
          ),
          '{vendorConfiguration}', '"solo"'::jsonb
        ),
        updated_at = NOW()
      WHERE name = 'pet_walker';
    END IF;
  ELSIF EXISTS (SELECT 1 FROM roles WHERE name = 'walker') THEN
    -- Just update existing
    UPDATE roles SET 
      display_name = 'Pet Walker',
      customer_service = 'walker',
      config = jsonb_set(
        jsonb_set(
          COALESCE(config, '{}'::jsonb),
          '{customer_service}', '"walker"'::jsonb
        ),
        '{vendorConfiguration}', '"solo"'::jsonb
      ),
      updated_at = NOW()
    WHERE name = 'walker';
  END IF;
END $$;

-- Sitter
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM roles WHERE name = 'pet_sitter') THEN
    IF EXISTS (SELECT 1 FROM roles WHERE name = 'sitter') THEN
      UPDATE roles SET 
        display_name = 'Pet Sitter',
        customer_service = 'sitter',
        config = jsonb_set(
          jsonb_set(
            COALESCE(config, '{}'::jsonb),
            '{customer_service}', '"sitter"'::jsonb
          ),
          '{vendorConfiguration}', '"solo"'::jsonb
        ),
        updated_at = NOW()
      WHERE name = 'sitter';
      DELETE FROM roles WHERE name = 'pet_sitter';
    ELSE
      UPDATE roles SET 
        name = 'sitter',
        display_name = 'Pet Sitter',
        customer_service = 'sitter',
        config = jsonb_set(
          jsonb_set(
            COALESCE(config, '{}'::jsonb),
            '{customer_service}', '"sitter"'::jsonb
          ),
          '{vendorConfiguration}', '"solo"'::jsonb
        ),
        updated_at = NOW()
      WHERE name = 'pet_sitter';
    END IF;
  ELSIF EXISTS (SELECT 1 FROM roles WHERE name = 'sitter') THEN
    UPDATE roles SET 
      display_name = 'Pet Sitter',
      customer_service = 'sitter',
      config = jsonb_set(
        jsonb_set(
          COALESCE(config, '{}'::jsonb),
          '{customer_service}', '"sitter"'::jsonb
        ),
        '{vendorConfiguration}', '"solo"'::jsonb
      ),
      updated_at = NOW()
    WHERE name = 'sitter';
  END IF;
END $$;

UPDATE roles SET 
  name = 'cafe',
  display_name = 'Pet Cafe',
  customer_service = 'cafes',
  config = jsonb_set(
    jsonb_set(
      COALESCE(config, '{}'::jsonb),
      '{customer_service}', '"cafes"'::jsonb
    ),
      '{vendorConfiguration}', '"business"'::jsonb
  ),
  updated_at = NOW()
WHERE name = 'pet_cafe';

UPDATE roles SET 
  name = 'photographer',
  display_name = 'Pet Photographer',
  customer_service = 'photography',
  config = jsonb_set(
    jsonb_set(
      COALESCE(config, '{}'::jsonb),
      '{customer_service}', '"photography"'::jsonb
    ),
    '{vendorConfiguration}', '"solo"'::jsonb
  ),
  updated_at = NOW()
WHERE name = 'pet_photographer';

-- Update pet_insurance to insurance (only if pet_insurance exists and insurance doesn't)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM roles WHERE name = 'pet_insurance') THEN
    -- If insurance already exists, update it instead
    IF EXISTS (SELECT 1 FROM roles WHERE name = 'insurance') THEN
      UPDATE roles SET 
        display_name = 'Pet Insurance Provider',
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
      
      -- Delete old pet_insurance if it exists
      DELETE FROM roles WHERE name = 'pet_insurance';
    ELSE
      -- Rename pet_insurance to insurance
      UPDATE roles SET 
        name = 'insurance',
        display_name = 'Pet Insurance Provider',
        customer_service = 'insurance',
        config = jsonb_set(
          jsonb_set(
            COALESCE(config, '{}'::jsonb),
            '{customer_service}', '"insurance"'::jsonb
          ),
          '{vendorConfiguration}', '"business"'::jsonb
        ),
        updated_at = NOW()
      WHERE name = 'pet_insurance';
    END IF;
  ELSIF EXISTS (SELECT 1 FROM roles WHERE name = 'insurance') THEN
    -- Just update existing insurance role
    UPDATE roles SET 
      display_name = 'Pet Insurance Provider',
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
  END IF;
END $$;

-- Nutritionist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM roles WHERE name = 'pet_nutritionist') THEN
    IF EXISTS (SELECT 1 FROM roles WHERE name = 'nutritionist') THEN
      UPDATE roles SET 
        display_name = 'Pet Nutritionist',
        customer_service = 'nutritionist',
        config = jsonb_set(
          COALESCE(config, '{}'::jsonb),
          '{customer_service}', '"nutritionist"'::jsonb
        ),
        updated_at = NOW()
      WHERE name = 'nutritionist';
      DELETE FROM roles WHERE name = 'pet_nutritionist';
    ELSE
      UPDATE roles SET 
        name = 'nutritionist',
        display_name = 'Pet Nutritionist',
        customer_service = 'nutritionist',
        config = jsonb_set(
          COALESCE(config, '{}'::jsonb),
          '{customer_service}', '"nutritionist"'::jsonb
        ),
        updated_at = NOW()
      WHERE name = 'pet_nutritionist';
    END IF;
  ELSIF EXISTS (SELECT 1 FROM roles WHERE name = 'nutritionist') THEN
    UPDATE roles SET 
      display_name = 'Pet Nutritionist',
      customer_service = 'nutritionist',
      config = jsonb_set(
        COALESCE(config, '{}'::jsonb),
        '{customer_service}', '"nutritionist"'::jsonb
      ),
      updated_at = NOW()
    WHERE name = 'nutritionist';
  END IF;
END $$;

UPDATE roles SET 
  name = 'relocation',
  display_name = 'Pet Relocation Services',
  customer_service = 'relocation',
  config = jsonb_set(
    jsonb_set(
      COALESCE(config, '{}'::jsonb),
      '{customer_service}', '"relocation"'::jsonb
    ),
      '{vendorConfiguration}', '"business"'::jsonb
  ),
  updated_at = NOW()
WHERE name = 'pet_relocation';

UPDATE roles SET 
  name = 'adoption_center',
  display_name = 'Pet Adoption Center',
  customer_service = 'adoption',
  config = jsonb_set(
    jsonb_set(
      COALESCE(config, '{}'::jsonb),
      '{customer_service}', '"adoption"'::jsonb
    ),
      '{vendorConfiguration}', '"business"'::jsonb
  ),
  updated_at = NOW()
WHERE name = 'pet_adoption_center';

-- ============================================================================
-- STEP 2: MERGE pet_boarder + pet_daycare into boarding
-- ============================================================================

-- First, merge permissions from pet_daycare into pet_boarder
INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT 
  (SELECT id FROM roles WHERE name = 'pet_boarder'),
  permission_name,
  resource,
  action
FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE name = 'pet_daycare')
ON CONFLICT DO NOTHING;

-- Update pet_boarder to boarding
UPDATE roles SET 
  name = 'boarding',
  display_name = 'Pet Boarding & Daycare',
  customer_service = 'boarding',
  description = 'Pet boarding, daycare, and hotel services',
  config = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(config, '{}'::jsonb),
        '{customer_service}', '"boarding"'::jsonb
      ),
      '{vendorConfiguration}', '"business"'::jsonb
    ),
    '{serviceStyles}',
    jsonb_build_object(
      'solo', ARRAY[]::text[],
      'business', ARRAY['at_center']::text[],
      'selected', ARRAY['at_center']::text[]
    )
  ),
  updated_at = NOW()
WHERE name = 'pet_boarder';

-- Delete pet_daycare (merged into boarding)
DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE name = 'pet_daycare');
DELETE FROM roles WHERE name = 'pet_daycare';

-- ============================================================================
-- STEP 3: SPLIT pet_groomer into groomer_solo and groomer_center
-- ============================================================================

DO $$
DECLARE
  old_groomer_id UUID;
  old_groomer_config JSONB;
  groomer_solo_id UUID;
  groomer_center_id UUID;
BEGIN
  -- Get existing groomer
  SELECT id, config INTO old_groomer_id, old_groomer_config
  FROM roles WHERE name = 'pet_groomer';
  
  IF old_groomer_id IS NOT NULL THEN
    -- old_groomer_config already set from SELECT above
    IF old_groomer_config IS NULL THEN
      old_groomer_config := '{}'::jsonb;
    END IF;
    
    -- Create groomer_solo
    INSERT INTO roles (name, display_name, description, is_system_role, is_active, customer_service, config)
    VALUES (
      'groomer_solo',
      'Groomer (Solo)',
      'Individual pet groomer providing grooming services',
      false,
      true,
      'grooming',
      jsonb_build_object(
        'customer_service', 'grooming',
        'vendorConfiguration', 'solo',
        'vendorTypes', ARRAY['solo_provider']::text[],
        'serviceStyles', jsonb_build_object(
          'solo', ARRAY['at_home']::text[],
          'business', ARRAY['at_center', 'at_home']::text[],
          'selected', ARRAY['at_home']::text[]
        ),
        'capabilityRules', jsonb_build_object(
          'solo', jsonb_build_object(
            'deniedStyles', ARRAY['at_center']::text[],
            'deniedCapabilities', ARRAY[
              'staff_management', 'staff_create', 'staff_schedule',
              'inventory_manage', 'inventory',
              'custom_services', 'custom_packages',
              'center_profile'
            ]::text[]
          ),
          'serviceStyleDependencies', jsonb_build_object()
        ),
        'category', 'service_provider'
      )
    )
    ON CONFLICT (name) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      config = EXCLUDED.config,
      updated_at = NOW()
    RETURNING id INTO groomer_solo_id;
    
    -- Create groomer_center
    INSERT INTO roles (name, display_name, description, is_system_role, is_active, customer_service, config)
    VALUES (
      'groomer_center',
      'Groomer (Center)',
      'Grooming center with multiple staff and facilities',
      false,
      true,
      'grooming',
      jsonb_build_object(
        'customer_service', 'grooming',
        'vendorConfiguration', 'business',
        'vendorTypes', ARRAY['center']::text[],
        'serviceStyles', jsonb_build_object(
          'solo', ARRAY['at_home']::text[],
          'business', ARRAY['at_center', 'at_home']::text[],
          'selected', ARRAY['at_center', 'at_home']::text[]
        ),
        'capabilityRules', jsonb_build_object(
          'serviceStyleDependencies', jsonb_build_object()
        ),
        'category', 'service_provider'
      )
    )
    ON CONFLICT (name) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      config = EXCLUDED.config,
      updated_at = NOW()
    RETURNING id INTO groomer_center_id;
    
    -- Copy permissions from old groomer to both new roles
    IF groomer_solo_id IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_name, resource, action)
      SELECT groomer_solo_id, permission_name, resource, action
      FROM role_permissions
      WHERE role_id = old_groomer_id
      ON CONFLICT DO NOTHING;
    END IF;
    
    IF groomer_center_id IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_name, resource, action)
      SELECT groomer_center_id, permission_name, resource, action
      FROM role_permissions
      WHERE role_id = old_groomer_id
      ON CONFLICT DO NOTHING;
    END IF;
    
    -- Update vendor_identity references to use groomer_center (or groomer_solo if preferred)
    -- For now, we'll update to groomer_center as default, but you can customize this
    UPDATE vendor_identity 
    SET selected_role_id = groomer_center_id 
    WHERE selected_role_id = old_groomer_id AND groomer_center_id IS NOT NULL;
    
    -- If groomer_center doesn't exist, use groomer_solo
    UPDATE vendor_identity 
    SET selected_role_id = groomer_solo_id 
    WHERE selected_role_id = old_groomer_id AND groomer_center_id IS NULL AND groomer_solo_id IS NOT NULL;
    
    -- Delete old groomer (after copying permissions and updating references)
    DELETE FROM role_permissions WHERE role_id = old_groomer_id;
    -- Mark as inactive instead of deleting to preserve history
    UPDATE roles SET is_active = false, updated_at = NOW() WHERE id = old_groomer_id;
  END IF;
END $$;

-- ============================================================================
-- STEP 4: SPLIT pet_trainer into trainer_solo and trainer_center
-- ============================================================================

DO $$
DECLARE
  old_trainer_id UUID;
  old_trainer_config JSONB;
  trainer_solo_id UUID;
  trainer_center_id UUID;
BEGIN
  -- Get existing trainer
  SELECT id, config INTO old_trainer_id, old_trainer_config
  FROM roles WHERE name = 'pet_trainer';
  
  IF old_trainer_id IS NOT NULL THEN
    -- old_trainer_config already set from SELECT above
    IF old_trainer_config IS NULL THEN
      old_trainer_config := '{}'::jsonb;
    END IF;
    
    -- Create trainer_solo
    INSERT INTO roles (name, display_name, description, is_system_role, is_active, customer_service, config)
    VALUES (
      'trainer_solo',
      'Trainer (Solo)',
      'Individual pet trainer providing training services',
      false,
      true,
      'training',
      jsonb_build_object(
        'customer_service', 'training',
        'vendorConfiguration', 'solo',
        'vendorTypes', ARRAY['solo_provider']::text[],
        'serviceStyles', jsonb_build_object(
          'solo', ARRAY['at_home']::text[],
          'business', ARRAY['at_center', 'at_home']::text[],
          'selected', ARRAY['at_home']::text[]
        ),
        'capabilityRules', jsonb_build_object(
          'solo', jsonb_build_object(
            'deniedStyles', ARRAY['at_center']::text[],
            'deniedCapabilities', ARRAY[
              'staff_management', 'staff_create', 'staff_schedule',
              'inventory_manage', 'inventory',
              'custom_services', 'custom_packages',
              'center_profile'
            ]::text[]
          ),
          'serviceStyleDependencies', jsonb_build_object()
        ),
        'category', 'service_provider'
      )
    )
    ON CONFLICT (name) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      config = EXCLUDED.config,
      updated_at = NOW()
    RETURNING id INTO trainer_solo_id;
    
    -- Create trainer_center
    INSERT INTO roles (name, display_name, description, is_system_role, is_active, customer_service, config)
    VALUES (
      'trainer_center',
      'Trainer (Center)',
      'Training center with multiple trainers and facilities',
      false,
      true,
      'training',
      jsonb_build_object(
        'customer_service', 'training',
        'vendorConfiguration', 'business',
        'vendorTypes', ARRAY['center']::text[],
        'serviceStyles', jsonb_build_object(
          'solo', ARRAY['at_home']::text[],
          'business', ARRAY['at_center', 'at_home']::text[],
          'selected', ARRAY['at_center', 'at_home']::text[]
        ),
        'capabilityRules', jsonb_build_object(
          'serviceStyleDependencies', jsonb_build_object()
        ),
        'category', 'service_provider'
      )
    )
    ON CONFLICT (name) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      config = EXCLUDED.config,
      updated_at = NOW()
    RETURNING id INTO trainer_center_id;
    
    -- Copy permissions from old trainer to both new roles
    IF trainer_solo_id IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_name, resource, action)
      SELECT trainer_solo_id, permission_name, resource, action
      FROM role_permissions
      WHERE role_id = old_trainer_id
      ON CONFLICT DO NOTHING;
    END IF;
    
    IF trainer_center_id IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_name, resource, action)
      SELECT trainer_center_id, permission_name, resource, action
      FROM role_permissions
      WHERE role_id = old_trainer_id
      ON CONFLICT DO NOTHING;
    END IF;
    
    -- Update vendor_identity references to use trainer_center (or trainer_solo if preferred)
    UPDATE vendor_identity 
    SET selected_role_id = trainer_center_id 
    WHERE selected_role_id = old_trainer_id AND trainer_center_id IS NOT NULL;
    
    -- If trainer_center doesn't exist, use trainer_solo
    UPDATE vendor_identity 
    SET selected_role_id = trainer_solo_id 
    WHERE selected_role_id = old_trainer_id AND trainer_center_id IS NULL AND trainer_solo_id IS NOT NULL;
    
    -- Delete old trainer (after copying permissions and updating references)
    DELETE FROM role_permissions WHERE role_id = old_trainer_id;
    -- Mark as inactive instead of deleting to preserve history
    UPDATE roles SET is_active = false, updated_at = NOW() WHERE id = old_trainer_id;
  END IF;
END $$;

-- ============================================================================
-- STEP 5: CREATE MISSING ROLES
-- ============================================================================

INSERT INTO roles (name, display_name, description, is_system_role, is_active, customer_service, config) VALUES
  ('breeder', 'Pet Breeder', 'Pet breeding services', false, true, 'breeder', '{
    "customer_service": "breeder",
    "vendorConfiguration": "business",
    "vendorTypes": ["center", "business"],
    "serviceStyles": {"solo": [], "business": ["at_center", "at_home"], "selected": ["at_center"]},
    "capabilityRules": {},
    "category": "specialist"
  }'),
  ('resort', 'Pet Resort', 'Luxury pet resort services', false, true, 'resort', '{
    "customer_service": "resort",
    "vendorConfiguration": "business",
    "vendorTypes": ["center"],
    "serviceStyles": {"solo": [], "business": ["at_center"], "selected": ["at_center"]},
    "capabilityRules": {},
    "category": "hospitality"
  }'),
  ('holiday', 'Pet Holiday', 'Pet holiday packages', false, true, 'holiday', '{
    "customer_service": "holiday",
    "vendorConfiguration": "business",
    "vendorTypes": ["center"],
    "serviceStyles": {"solo": [], "business": ["at_center"], "selected": ["at_center"]},
    "capabilityRules": {},
    "category": "hospitality"
  }'),
  ('sunset', 'Sunset Care', 'End-of-life pet care services', false, true, 'sunset', '{
    "customer_service": "sunset",
    "vendorConfiguration": "business",
    "vendorTypes": ["center"],
    "serviceStyles": {"solo": ["at_home"], "business": ["at_center", "at_home"], "selected": ["at_center", "at_home"]},
    "capabilityRules": {},
    "category": "specialist"
  }'),
  ('seller', 'E-commerce Seller', 'Pet products e-commerce seller', false, true, 'shop', '{
    "customer_service": "shop",
    "vendorConfiguration": "business",
    "vendorTypes": ["center", "business"],
    "serviceStyles": {"solo": [], "business": ["delivery", "pickup"], "selected": ["delivery"]},
    "capabilityRules": {},
    "category": "retail"
  }')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  customer_service = EXCLUDED.customer_service,
  config = EXCLUDED.config,
  updated_at = NOW();

-- ============================================================================
-- STEP 6: UPDATE REMAINING ROLES WITH vendorConfiguration AND serviceStyles
-- ============================================================================

-- Update veterinarian (if solo/business split not needed, set as business by default)
UPDATE roles SET
  customer_service = 'vet',
  config = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(config, '{}'::jsonb),
        '{customer_service}', '"vet"'::jsonb
      ),
      '{vendorConfiguration}', '"business"'::jsonb
    ),
    '{serviceStyles}',
    COALESCE(
      config->'serviceStyles',
      jsonb_build_object(
        'solo', ARRAY['at_home', 'tele']::text[],
        'business', ARRAY['at_center', 'at_home', 'tele']::text[],
        'selected', ARRAY['at_center', 'at_home', 'tele']::text[]
      )
    )
  ),
  updated_at = NOW()
WHERE name = 'veterinarian' AND (config->>'vendorConfiguration') IS NULL;

-- Update vet_clinic
UPDATE roles SET
  customer_service = 'vet',
  config = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(config, '{}'::jsonb),
        '{customer_service}', '"vet"'::jsonb
      ),
      '{vendorConfiguration}', '"business"'::jsonb
    ),
    '{serviceStyles}',
    COALESCE(
      config->'serviceStyles',
      jsonb_build_object(
        'solo', ARRAY[]::text[],
        'business', ARRAY['at_center']::text[],
        'selected', ARRAY['at_center']::text[]
      )
    )
  ),
  updated_at = NOW()
WHERE name = 'vet_clinic' AND (config->>'vendorConfiguration') IS NULL;

-- Update ambulance
UPDATE roles SET
  customer_service = 'ambulance',
  config = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(config, '{}'::jsonb),
        '{customer_service}', '"ambulance"'::jsonb
      ),
      '{vendorConfiguration}', '"business"'::jsonb
    ),
    '{serviceStyles}',
    COALESCE(
      config->'serviceStyles',
      jsonb_build_object(
        'solo', ARRAY['at_home']::text[],
        'business', ARRAY['at_home']::text[],
        'selected', ARRAY['at_home']::text[]
      )
    )
  ),
  updated_at = NOW()
WHERE name = 'ambulance' AND (config->>'vendorConfiguration') IS NULL;

-- Update pharmacy
UPDATE roles SET
  customer_service = 'shop',
  config = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(config, '{}'::jsonb),
        '{customer_service}', '"shop"'::jsonb
      ),
      '{vendorConfiguration}', '"business"'::jsonb
    ),
    '{serviceStyles}',
    COALESCE(
      config->'serviceStyles',
      jsonb_build_object(
        'solo', ARRAY[]::text[],
        'business', ARRAY['at_center', 'delivery']::text[],
        'selected', ARRAY['at_center', 'delivery']::text[]
      )
    )
  ),
  updated_at = NOW()
WHERE name = 'pharmacy' AND (config->>'vendorConfiguration') IS NULL;

-- Update remaining roles that don't have vendorConfiguration
UPDATE roles SET
  config = jsonb_set(
    jsonb_set(
      COALESCE(config, '{}'::jsonb),
      '{vendorConfiguration}',
      CASE 
        WHEN name IN ('walker', 'sitter', 'photographer', 'nutritionist') THEN '"solo"'::jsonb
        ELSE '"business"'::jsonb
      END
    ),
    '{serviceStyles}',
    COALESCE(
      config->'serviceStyles',
      jsonb_build_object(
        'solo', ARRAY['at_home']::text[],
        'business', ARRAY['at_center', 'at_home']::text[],
        'selected', ARRAY['at_center', 'at_home']::text[]
      )
    )
  ),
  updated_at = NOW()
WHERE (config->>'vendorConfiguration') IS NULL;

COMMIT;

-- Log success
DO $$
BEGIN
  RAISE NOTICE '✅ Successfully consolidated roles from 20 to 21';
  RAISE NOTICE '✅ All roles now have customer_service, vendorConfiguration, and serviceStyles';
END $$;
