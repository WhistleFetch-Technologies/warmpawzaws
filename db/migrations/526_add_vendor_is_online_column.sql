-- ============================================================================
-- MIGRATION: Add is_online and went_offline_at columns to vendors table
-- Version: 526
-- Description: Adds is_online and went_offline_at columns for vendor online/offline toggle
--              This migration is idempotent and safe to run multiple times
-- ============================================================================

-- Add is_online column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'is_online'
  ) THEN
    ALTER TABLE vendors 
    ADD COLUMN is_online BOOLEAN DEFAULT true;
    
    COMMENT ON COLUMN vendors.is_online IS 
      'Whether the vendor is currently online and accepting bookings (for solo providers)';
    
    RAISE NOTICE 'Added is_online column to vendors table';
  ELSE
    RAISE NOTICE 'Column is_online already exists in vendors table';
  END IF;
END $$;

-- Add went_offline_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'went_offline_at'
  ) THEN
    ALTER TABLE vendors 
    ADD COLUMN went_offline_at TIMESTAMPTZ;
    
    COMMENT ON COLUMN vendors.went_offline_at IS 
      'Timestamp when vendor went offline (for tracking)';
    
    RAISE NOTICE 'Added went_offline_at column to vendors table';
  ELSE
    RAISE NOTICE 'Column went_offline_at already exists in vendors table';
  END IF;
END $$;

-- Create index on is_online for performance (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_vendors_is_online ON vendors(is_online) WHERE is_online = true;

-- Update existing vendors to be online by default (if column was just added)
DO $$
BEGIN
  -- Only update if we just added the column (check if any NULL values exist)
  IF EXISTS (
    SELECT 1 FROM vendors WHERE is_online IS NULL
  ) THEN
    UPDATE vendors SET is_online = true WHERE is_online IS NULL;
    RAISE NOTICE 'Updated existing vendors to be online by default';
  END IF;
END $$;
