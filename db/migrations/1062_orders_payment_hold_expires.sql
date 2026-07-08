-- ============================================================================
-- MIGRATION 1062: Payment hold expiry for unpaid ecommerce orders
-- ============================================================================
-- 5-minute soft hold while customer completes Razorpay checkout.
-- Draft orders use order_status = 'pending_payment' and are hidden from vendors
-- until payment succeeds within the window.
-- ============================================================================

-- Expand order_status CHECK to allow pending_payment
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'orders'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%order_status%'
  LOOP
    EXECUTE format('ALTER TABLE orders DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE orders
  ADD CONSTRAINT orders_order_status_check
  CHECK (order_status IN (
    'pending',
    'pending_payment',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'returned'
  ));

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_hold_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_checkout_started_at TIMESTAMPTZ;

COMMENT ON COLUMN orders.payment_hold_expires_at IS
  'When an unpaid pending_payment shop order is discarded if still unpaid (default: checkout start + 5 minutes).';
COMMENT ON COLUMN orders.payment_checkout_started_at IS
  'When the customer entered Razorpay checkout for this shop order.';

CREATE INDEX IF NOT EXISTS idx_orders_payment_hold_expiry
  ON orders (payment_hold_expires_at)
  WHERE order_status = 'pending_payment';

-- Backfill unpaid online drafts (legacy pending+unpaid and any pending_payment missing expiry)
UPDATE orders
SET payment_checkout_started_at = COALESCE(payment_checkout_started_at, created_at),
    payment_hold_expires_at = COALESCE(payment_hold_expires_at, created_at + INTERVAL '5 minutes'),
    order_status = CASE
      WHEN order_status = 'pending'
        AND LOWER(COALESCE(payment_status, '')) NOT IN ('paid', 'completed', 'refunded')
        AND LOWER(COALESCE(payment_method, 'online')) NOT IN ('cod', 'cash_on_delivery')
      THEN 'pending_payment'
      ELSE order_status
    END
WHERE (
    order_status = 'pending_payment'
    OR (
      order_status = 'pending'
      AND LOWER(COALESCE(payment_status, '')) NOT IN ('paid', 'completed', 'refunded')
      AND LOWER(COALESCE(payment_method, 'online')) NOT IN ('cod', 'cash_on_delivery')
    )
  )
  AND payment_hold_expires_at IS NULL;

-- Status-only expire for already-stale holds (app discard path restores stock/wallet for future expires)
UPDATE orders o
SET order_status = 'cancelled',
    payment_status = 'expired',
    cancellation_reason = COALESCE(cancellation_reason, 'payment_window_expired'),
    cancelled_at = COALESCE(cancelled_at, NOW()),
    updated_at = NOW()
WHERE o.order_status = 'pending_payment'
  AND o.payment_hold_expires_at IS NOT NULL
  AND o.payment_hold_expires_at <= NOW()
  AND LOWER(COALESCE(o.payment_status, '')) NOT IN ('paid', 'completed', 'refunded');
