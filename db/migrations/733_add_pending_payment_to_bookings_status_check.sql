-- ============================================================================
-- MIGRATION 733: Add pending_payment to bookings status CHECK constraint
-- ============================================================================
-- Purpose: Allow status 'pending_payment' when payment is pending and amount > 0
--          (see bookings-enhanced.booking.ts). Aligns with migration 615 list + pending_payment.
-- ============================================================================

-- Step 1: Drop existing constraint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_status_check') THEN
    ALTER TABLE bookings DROP CONSTRAINT bookings_status_check;
    RAISE NOTICE 'Dropped existing bookings_status_check constraint';
  ELSE
    RAISE NOTICE 'bookings_status_check constraint does not exist, skipping drop';
  END IF;
END $$;

-- Step 2: Same allowed statuses as 615, plus pending_payment
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK (status IN (
  -- Core booking statuses
  'pending', 'confirmed', 'scheduled', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled',
  -- Package states
  'partially_completed',
  -- Subscription states
  'active', 'paused', 'renewal_pending', 'expired',
  -- Insurance states
  'claim_pending', 'claim_approved', 'claim_rejected',
  -- Adoption states
  'approved', 'rejected',
  -- Vendor travel states
  'vendor_on_way', 'in_transit', 'arrived', 'dispatched',
  -- Diagnostics states
  'sample_collected', 'sample_received_at_lab', 'processing', 'reports_ready',
  -- Payment-before-service
  'pending_payment'
));

COMMENT ON COLUMN bookings.status IS 'Booking status. Includes vendor travel states: vendor_on_way, in_transit, arrived for GPS tracking; pending_payment when payment is pending and amount > 0.';
