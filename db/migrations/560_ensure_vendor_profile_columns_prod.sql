-- ============================================================================
-- MIGRATION: Ensure vendor profile columns exist (PROD FIX)
-- Version: 560
-- Description: Ensures profile_photo_url, pincode (nullable), and service_radius 
--              columns exist in vendors table for production compatibility
--              This migration is idempotent and safe to run multiple times
-- Date: 2026-02-20
-- ============================================================================

-- ============================================================================
-- 1. Ensure profile_photo_url column exists
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'profile_photo_url'
  ) THEN
    ALTER TABLE vendors 
    ADD COLUMN profile_photo_url TEXT;
    
    COMMENT ON COLUMN vendors.profile_photo_url IS 
      'URL to vendor profile photo (stored in S3, accessed via presigned URLs)';
    
    RAISE NOTICE 'Added profile_photo_url column to vendors table';
  ELSE
    RAISE NOTICE 'Column profile_photo_url already exists in vendors table';
  END IF;
END $$;

-- ============================================================================
-- 2. Ensure pincode column exists and is nullable (for prod compatibility)
-- ============================================================================
DO $$ 
BEGIN
  -- Check if pincode column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'pincode'
  ) THEN
    -- Add pincode column as nullable (allows empty strings during onboarding)
    ALTER TABLE vendors 
    ADD COLUMN pincode TEXT;
    
    COMMENT ON COLUMN vendors.pincode IS 
      'Vendor location pincode (6-digit postal code). Can be empty during onboarding.';
    
    RAISE NOTICE 'Added pincode column to vendors table';
  ELSE
    -- If column exists, check if it's NOT NULL and make it nullable if needed
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'vendors' 
      AND column_name = 'pincode' 
      AND is_nullable = 'NO'
    ) THEN
      -- Make pincode nullable to allow empty values during onboarding
      ALTER TABLE vendors 
      ALTER COLUMN pincode DROP NOT NULL;
      
      RAISE NOTICE 'Made pincode column nullable for onboarding compatibility';
    ELSE
      RAISE NOTICE 'Column pincode already exists and is nullable';
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 3. Ensure service_radius column exists
-- ============================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'service_radius'
  ) THEN
    ALTER TABLE vendors 
    ADD COLUMN service_radius NUMERIC(5, 2);
    
    COMMENT ON COLUMN vendors.service_radius IS 
      'Service radius in kilometers for at_home services';
    
    RAISE NOTICE 'Added service_radius column to vendors table';
  ELSE
    RAISE NOTICE 'Column service_radius already exists in vendors table';
  END IF;
END $$;

-- ============================================================================
-- 4. Ensure qualifications, service_area, description columns exist (for profile completion)
-- ============================================================================
DO $$ 
BEGIN
  -- Qualifications
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'qualifications'
  ) THEN
    ALTER TABLE vendors 
    ADD COLUMN qualifications TEXT;
    
    COMMENT ON COLUMN vendors.qualifications IS 
      'Professional qualifications and certifications';
    
    RAISE NOTICE 'Added qualifications column to vendors table';
  END IF;
  
  -- Service area
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'service_area'
  ) THEN
    ALTER TABLE vendors 
    ADD COLUMN service_area TEXT;
    
    COMMENT ON COLUMN vendors.service_area IS 
      'Service area coverage description';
    
    RAISE NOTICE 'Added service_area column to vendors table';
  END IF;
  
  -- Description
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'description'
  ) THEN
    ALTER TABLE vendors 
    ADD COLUMN description TEXT;
    
    COMMENT ON COLUMN vendors.description IS 
      'Professional bio/description for vendor profile';
    
    RAISE NOTICE 'Added description column to vendors table';
  END IF;
END $$;

-- ============================================================================
-- 5. Create indexes for performance (if they don't exist)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vendors_profile_photo_url 
ON vendors(profile_photo_url) 
WHERE profile_photo_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vendors_service_radius 
ON vendors(service_radius) 
WHERE service_radius IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vendors_pincode 
ON vendors(pincode) 
WHERE pincode IS NOT NULL AND pincode != '';

-- ============================================================================
-- END OF MIGRATION 560
-- ============================================================================
