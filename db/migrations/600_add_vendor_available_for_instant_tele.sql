-- ============================================================================
-- MIGRATION: Add available_for_instant_tele column to vendors table
-- Version: 600
-- Description: Adds available_for_instant_tele BOOLEAN column to allow vendors
--              to opt-in/opt-out of instant tele consultation availability
--              This migration is idempotent and safe to run multiple times
-- ============================================================================

-- Add available_for_instant_tele column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'available_for_instant_tele'
  ) THEN
    ALTER TABLE vendors 
    ADD COLUMN available_for_instant_tele BOOLEAN DEFAULT false;
    
    COMMENT ON COLUMN vendors.available_for_instant_tele IS 
      'Whether the vendor is available for instant tele consultations (opt-in feature)';
    
    RAISE NOTICE 'Added available_for_instant_tele column to vendors table';
  ELSE
    RAISE NOTICE 'Column available_for_instant_tele already exists in vendors table';
  END IF;
END $$;

-- Create index on available_for_instant_tele for performance (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_vendors_available_for_instant_tele 
ON vendors(available_for_instant_tele) 
WHERE available_for_instant_tele = true;

-- ============================================================================
-- END OF MIGRATION 600
-- ============================================================================
