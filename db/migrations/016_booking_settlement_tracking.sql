-- ============================================================================
-- MIGRATION 016: Booking Settlement Tracking
-- ============================================================================
-- Date: 2025-01-28
-- Purpose: Add settled_at column to bookings table for explicit settlement tracking
-- ============================================================================

-- Add settled_at column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'settled_at'
  ) THEN
    ALTER TABLE bookings ADD COLUMN settled_at TIMESTAMPTZ;
    COMMENT ON COLUMN bookings.settled_at IS 'Timestamp when booking was included in a payout (settled)';
  END IF;
END $$;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_bookings_settled_at ON bookings(settled_at);
CREATE INDEX IF NOT EXISTS idx_bookings_settled_at_null ON bookings(settled_at) WHERE settled_at IS NULL;

-- Add comment
COMMENT ON INDEX idx_bookings_settled_at IS 'Index for filtering settled bookings';
COMMENT ON INDEX idx_bookings_settled_at_null IS 'Index for filtering unsettled bookings (for payout calculation)';

