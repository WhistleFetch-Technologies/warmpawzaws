-- Migration 538: Add cancelled_by and penalty_processed to bookings
-- Purpose: Enforce refund policy by who cancels (pet_parent vs provider) and support settlement penalty tracking.
-- cancelled_by: 'pet_parent' | 'provider' - who initiated the cancellation (customer or vendor/platform).
-- penalty_processed: used by settlement job to avoid double-processing vendor cancellation penalties.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS penalty_processed BOOLEAN DEFAULT false;

COMMENT ON COLUMN bookings.cancelled_by IS 'Who cancelled: pet_parent (customer) or provider (vendor/platform). Used to apply refund tier by canceller.';
COMMENT ON COLUMN bookings.penalty_processed IS 'True after vendor cancellation penalty has been applied in settlement.';

CREATE INDEX IF NOT EXISTS idx_bookings_cancelled_by ON bookings(cancelled_by) WHERE cancelled_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_penalty_processed ON bookings(penalty_processed) WHERE status = 'cancelled';
