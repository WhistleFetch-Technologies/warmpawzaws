-- ============================================================================
-- MIGRATION 139: ADD CUSTOMER_SERVICE COLUMN TO ROLES
-- ============================================================================
-- Date: 2026-01-16
-- Purpose: Add customer_service column, indexes, and constraints for role consolidation
-- Part of: Role Consolidation & Three-Level Enforcement Implementation
-- ============================================================================

BEGIN;

-- Step 1: Add customer_service column
ALTER TABLE roles 
  ADD COLUMN IF NOT EXISTS customer_service TEXT;

-- Step 2: Add constraint for valid customer services
ALTER TABLE roles 
  DROP CONSTRAINT IF EXISTS roles_customer_service_check;
  
ALTER TABLE roles 
  ADD CONSTRAINT roles_customer_service_check 
  CHECK (customer_service IS NULL OR customer_service IN (
    'vet', 'grooming', 'training', 'shop', 'walker', 'boarding', 
    'adoption', 'cafes', 'photography', 'insurance', 'breeder',
    'ambulance', 'nutritionist', 'relocation', 'resort', 'holiday', 
    'sunset', 'sitter'
  ));

-- Step 3: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_roles_customer_service 
  ON roles(customer_service) 
  WHERE customer_service IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_roles_config_vendor_config 
  ON roles((config->>'vendorConfiguration'))
  WHERE config->>'vendorConfiguration' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_roles_config_service_styles 
  ON roles USING gin((config->'serviceStyles'->'selected'))
  WHERE config->'serviceStyles'->'selected' IS NOT NULL;

-- Step 4: Add comments
COMMENT ON COLUMN roles.customer_service IS 'Maps role to customer app service (vet, grooming, etc.)';
COMMENT ON COLUMN roles.config IS 'JSONB containing vendorConfiguration, serviceStyles.selected, capabilityRules';

-- Verify config column exists (add if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'roles' AND column_name = 'config'
  ) THEN
    ALTER TABLE roles ADD COLUMN config JSONB DEFAULT '{}'::jsonb;
    RAISE NOTICE 'Added config column to roles table';
  END IF;
END $$;

COMMIT;

-- Log success
DO $$
BEGIN
  RAISE NOTICE '✅ Successfully added customer_service column and indexes to roles table';
END $$;
