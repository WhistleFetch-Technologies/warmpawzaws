-- ============================================================================
-- MIGRATION 754: Payment hold expiry for pending_payment bookings
-- ============================================================================
-- 5-minute soft slot hold while customer completes Razorpay checkout.
-- After expiry, booking is cancelled server-side and slot is released.
-- ============================================================================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_hold_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_checkout_started_at TIMESTAMPTZ;

COMMENT ON COLUMN bookings.payment_hold_expires_at IS
  'When an unpaid pending_payment booking stops blocking slots (default: checkout start + 5 minutes).';
COMMENT ON COLUMN bookings.payment_checkout_started_at IS
  'When the customer entered Razorpay checkout for this booking.';

CREATE INDEX IF NOT EXISTS idx_bookings_payment_hold_expiry
  ON bookings (payment_hold_expires_at)
  WHERE status = 'pending_payment';

-- Backfill active holds from created_at
UPDATE bookings
SET payment_checkout_started_at = COALESCE(payment_checkout_started_at, created_at),
    payment_hold_expires_at = COALESCE(payment_hold_expires_at, created_at + INTERVAL '5 minutes')
WHERE status = 'pending_payment'
  AND payment_hold_expires_at IS NULL;

-- Expire stale unpaid holds (no vendor notification — status only)
UPDATE bookings b
SET status = 'cancelled',
    cancelled_at = NOW(),
    cancellation_reason = 'payment_window_expired',
    updated_at = NOW()
WHERE b.status = 'pending_payment'
  AND b.payment_hold_expires_at IS NOT NULL
  AND b.payment_hold_expires_at <= NOW()
  AND NOT EXISTS (
    SELECT 1 FROM payments p
    WHERE p.booking_id = b.id
      AND LOWER(COALESCE(p.payment_status, '')) IN ('paid', 'completed')
  );
