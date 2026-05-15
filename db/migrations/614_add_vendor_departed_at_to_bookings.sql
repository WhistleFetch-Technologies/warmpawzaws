-- ============================================================================
-- MIGRATION 614: Add vendor_departed_at column to bookings table
-- ============================================================================
-- Date: 2026-03-15
-- Purpose: Add vendor_departed_at timestamp column to track when vendor
--          departs for home service bookings (for GPS tracking and ETA)
-- ============================================================================

-- Add vendor_departed_at column to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS vendor_departed_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN bookings.vendor_departed_at IS 'Timestamp when vendor departs for home service booking (used for GPS tracking and ETA calculation)';

-- Create index for efficient queries on vendor departure times
CREATE INDEX IF NOT EXISTS idx_bookings_vendor_departed_at 
ON bookings(vendor_departed_at) 
WHERE vendor_departed_at IS NOT NULL;
