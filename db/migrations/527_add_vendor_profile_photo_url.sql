-- ============================================================================
-- MIGRATION: Add profile_photo_url column to vendors table
-- Version: 527
-- Description: Adds profile_photo_url column for vendor profile photo storage
--              This migration is idempotent and safe to run multiple times
-- ============================================================================

-- Add profile_photo_url column if it doesn't exist
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
-- END OF MIGRATION 527
-- ============================================================================
