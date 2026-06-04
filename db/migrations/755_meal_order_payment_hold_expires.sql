-- ============================================================================
-- MIGRATION 755: Payment hold expiry for unpaid meal_orders
-- ============================================================================
-- 5-minute soft hold while customer completes Razorpay checkout for one-time meals.
-- After expiry, order is cancelled server-side (payment_window_expired).
-- ============================================================================

ALTER TABLE meal_orders
  ADD COLUMN IF NOT EXISTS payment_hold_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_checkout_started_at TIMESTAMPTZ;

COMMENT ON COLUMN meal_orders.payment_hold_expires_at IS
  'When an unpaid meal order stops blocking kitchen prep (default: checkout start + 5 minutes).';
COMMENT ON COLUMN meal_orders.payment_checkout_started_at IS
  'When the customer entered checkout for this meal order.';

CREATE INDEX IF NOT EXISTS idx_meal_orders_payment_hold_expiry
  ON meal_orders (payment_hold_expires_at)
  WHERE LOWER(COALESCE(payment_status, '')) NOT IN ('paid', 'completed');

-- Backfill active holds from created_at for pending unpaid orders
UPDATE meal_orders
SET payment_checkout_started_at = COALESCE(payment_checkout_started_at, created_at),
    payment_hold_expires_at = COALESCE(payment_hold_expires_at, created_at + INTERVAL '5 minutes')
WHERE LOWER(COALESCE(payment_status, '')) NOT IN ('paid', 'completed', 'expired', 'refunded')
  AND LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'delivered')
  AND payment_hold_expires_at IS NULL;

-- Expire stale unpaid holds
UPDATE meal_orders mo
SET status = 'cancelled',
    payment_status = 'expired',
    cancelled_at = NOW(),
    cancellation_reason = 'payment_window_expired',
    updated_at = NOW()
WHERE LOWER(COALESCE(mo.payment_status, '')) NOT IN ('paid', 'completed', 'expired', 'refunded')
  AND LOWER(COALESCE(mo.status, '')) NOT IN ('cancelled', 'delivered')
  AND mo.payment_hold_expires_at IS NOT NULL
  AND mo.payment_hold_expires_at <= NOW();
