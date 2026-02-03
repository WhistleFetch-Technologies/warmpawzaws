-- ============================================================================
-- MIGRATION: Add profile fields to vendors table for solo providers
-- Version: 528
-- Description: Adds qualifications, service_area, and description columns
--              for professional profile management (solo providers)
-- ============================================================================

-- Add qualifications column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'qualifications'
  ) THEN
    ALTER TABLE vendors 
    ADD COLUMN qualifications TEXT;
    
    COMMENT ON COLUMN vendors.qualifications IS 
      'Professional qualifications and certifications (e.g., BVSc, MVSc, Certified Pet Groomer)';
    
    RAISE NOTICE 'Added qualifications column to vendors table';
  ELSE
    RAISE NOTICE 'Column qualifications already exists in vendors table';
  END IF;
END $$;

-- Add service_area column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'service_area'
  ) THEN
    ALTER TABLE vendors 
    ADD COLUMN service_area TEXT;
    
    COMMENT ON COLUMN vendors.service_area IS 
      'Service area coverage description (e.g., Within 10km radius, All of South Mumbai)';
    
    RAISE NOTICE 'Added service_area column to vendors table';
  ELSE
    RAISE NOTICE 'Column service_area already exists in vendors table';
  END IF;
END $$;

-- Add description column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'description'
  ) THEN
    ALTER TABLE vendors 
    ADD COLUMN description TEXT;
    
    COMMENT ON COLUMN vendors.description IS 
      'Professional bio/description for vendor profile';
    
    RAISE NOTICE 'Added description column to vendors table';
  ELSE
    RAISE NOTICE 'Column description already exists in vendors table';
  END IF;
END $$;

-- ============================================================================
-- END OF MIGRATION 528
-- ============================================================================
