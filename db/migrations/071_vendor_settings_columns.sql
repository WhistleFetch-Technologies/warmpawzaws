-- ============================================================================
-- VENDOR SETTINGS COLUMNS MIGRATION
-- ============================================================================
-- 
-- Adds columns to vendors table for settings moved from onboarding:
-- - service_radius: Service radius in kilometers
-- - emergency_contact: Emergency contact information (JSONB)
-- - max_dogs_per_walk: Maximum dogs per walk (for walkers)
-- - walk_durations: Array of walk durations offered
-- - other_config: Additional configuration (JSONB)
--
-- Date: 2025-01-28
-- ============================================================================

-- Add service_radius column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'service_radius'
  ) THEN
    ALTER TABLE vendors ADD COLUMN service_radius NUMERIC(5, 2);
    COMMENT ON COLUMN vendors.service_radius IS 'Service radius in kilometers';
  END IF;
END $$;

-- Add emergency_contact column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'emergency_contact'
  ) THEN
    ALTER TABLE vendors ADD COLUMN emergency_contact JSONB DEFAULT NULL;
    COMMENT ON COLUMN vendors.emergency_contact IS 'Emergency contact information: {name: string, phone: string}';
  END IF;
END $$;

-- Add max_dogs_per_walk column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'max_dogs_per_walk'
  ) THEN
    ALTER TABLE vendors ADD COLUMN max_dogs_per_walk INTEGER;
    COMMENT ON COLUMN vendors.max_dogs_per_walk IS 'Maximum number of dogs per walk (for walkers)';
  END IF;
END $$;

-- Add walk_durations column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'walk_durations'
  ) THEN
    ALTER TABLE vendors ADD COLUMN walk_durations TEXT[] DEFAULT ARRAY[]::TEXT[];
    COMMENT ON COLUMN vendors.walk_durations IS 'Array of walk durations offered (e.g., ["15", "30", "60"])';
  END IF;
END $$;

-- Add other_config column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'other_config'
  ) THEN
    ALTER TABLE vendors ADD COLUMN other_config JSONB DEFAULT '{}'::jsonb;
    COMMENT ON COLUMN vendors.other_config IS 'Additional vendor configuration';
  END IF;
END $$;

-- Create index on service_radius for location-based queries
CREATE INDEX IF NOT EXISTS idx_vendors_service_radius ON vendors(service_radius) WHERE service_radius IS NOT NULL;
