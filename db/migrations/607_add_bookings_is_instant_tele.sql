-- ============================================================================
-- MIGRATION: Add is_instant_tele column to bookings table
-- Version: 607
-- Description: Adds is_instant_tele BOOLEAN column to track if a booking
--              was created through the instant tele consultation flow (V2 or V3)
--              This migration is idempotent and safe to run multiple times
-- ============================================================================

-- Add is_instant_tele column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'is_instant_tele'
  ) THEN
    ALTER TABLE bookings 
    ADD COLUMN is_instant_tele BOOLEAN DEFAULT false;
    
    COMMENT ON COLUMN bookings.is_instant_tele IS 
      'Indicates if this booking was created through the instant tele consultation flow (V2 or V3)';
    
    RAISE NOTICE 'Added is_instant_tele column to bookings table';
  ELSE
    RAISE NOTICE 'Column is_instant_tele already exists in bookings table';
  END IF;
END $$;

-- Create index on is_instant_tele for performance (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_bookings_is_instant_tele 
ON bookings(is_instant_tele) 
WHERE is_instant_tele = true;

-- ============================================================================
-- END OF MIGRATION 607
-- ============================================================================
