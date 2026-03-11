-- ============================================================================
-- Add 'arrived' status to bookings status CHECK constraint
-- ============================================================================
-- This migration adds 'arrived' to the allowed statuses in the bookings table
-- CHECK constraint, allowing vendors to mark bookings as 'arrived' when they
-- reach the customer's location.
-- ============================================================================

-- Step 1: Drop existing constraint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_status_check') THEN
    ALTER TABLE bookings DROP CONSTRAINT bookings_status_check;
  END IF;
END $$;

-- Step 2: Add new constraint with all existing statuses plus 'arrived'
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK (status IN (
  -- Core booking statuses
  'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled',
  -- Package states
  'partially_completed',
  -- Subscription states
  'active', 'paused', 'renewal_pending', 'expired',
  -- Insurance states
  'claim_pending', 'claim_approved', 'claim_rejected',
  -- Adoption states
  'approved', 'rejected',
  -- Vendor arrival state (NEW)
  'arrived'
));

COMMENT ON COLUMN bookings.status IS 'Booking status. Includes arrived status for vendor arrival tracking.';
