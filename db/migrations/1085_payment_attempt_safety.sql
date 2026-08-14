-- ============================================================================
-- MIGRATION 1085: Payment attempt safety (one active payable + unique RZP order)
-- ============================================================================
-- Money-safety invariants:
--   1. At most one pending/processing payments row per booking.
--   2. At most one pending/processing payments row per shop order.
--   3. razorpay_order_id unique when present.
--   4. At most one in-flight (pending/processing) refund row per payment.
--      Completed historical refunds are never rewritten.
--   5. Razorpay webhook event ids for replay dedupe.
-- Historical payment rows are NEVER deleted. Extra active attempts are marked
-- failed so unique indexes can apply on dirty production data.
-- ============================================================================

-- 1) Collapse extra active payable attempts per booking (keep newest).
UPDATE payments p
SET payment_status = 'failed',
    failure_reason = COALESCE(NULLIF(BTRIM(p.failure_reason), ''), 'superseded_active_attempt'),
    updated_at = NOW()
WHERE p.booking_id IS NOT NULL
  AND LOWER(COALESCE(p.payment_status, '')) IN ('pending', 'processing')
  AND p.id NOT IN (
    SELECT DISTINCT ON (x.booking_id) x.id
    FROM payments x
    WHERE x.booking_id IS NOT NULL
      AND LOWER(COALESCE(x.payment_status, '')) IN ('pending', 'processing')
    ORDER BY x.booking_id, x.created_at DESC NULLS LAST, x.id DESC
  );

-- 2) Collapse extra active payable attempts per shop order (booking_id IS NULL).
UPDATE payments p
SET payment_status = 'failed',
    failure_reason = COALESCE(NULLIF(BTRIM(p.failure_reason), ''), 'superseded_active_attempt'),
    updated_at = NOW()
WHERE p.order_id IS NOT NULL
  AND p.booking_id IS NULL
  AND p.pharmacy_order_id IS NULL
  AND LOWER(COALESCE(p.payment_status, '')) IN ('pending', 'processing')
  AND p.id NOT IN (
    SELECT DISTINCT ON (x.order_id) x.id
    FROM payments x
    WHERE x.order_id IS NOT NULL
      AND x.booking_id IS NULL
      AND x.pharmacy_order_id IS NULL
      AND LOWER(COALESCE(x.payment_status, '')) IN ('pending', 'processing')
    ORDER BY x.order_id, x.created_at DESC NULLS LAST, x.id DESC
  );

-- 3) Duplicate razorpay_order_id: keep the captured/newest row, clear the id on losers
--    (original id is preserved in failure_reason). Rows themselves stay auditable.
UPDATE payments p
SET failure_reason = LEFT(
      CONCAT_WS(' | ', NULLIF(BTRIM(p.failure_reason), ''), CONCAT('duplicate_order_id:', d.razorpay_order_id)),
      500
    ),
    razorpay_order_id = NULL,
    updated_at = NOW()
FROM (
  SELECT id, razorpay_order_id,
         ROW_NUMBER() OVER (
           PARTITION BY razorpay_order_id
           ORDER BY
             CASE WHEN LOWER(COALESCE(payment_status, '')) IN ('completed', 'paid') THEN 0 ELSE 1 END,
             created_at DESC NULLS LAST,
             id DESC
         ) AS rn
  FROM payments
  WHERE razorpay_order_id IS NOT NULL
    AND BTRIM(razorpay_order_id) <> ''
) d
WHERE p.id = d.id
  AND d.rn > 1;

-- 4) Extra in-flight refunds per payment: keep newest pending/processing.
-- Do NOT rewrite completed/approved historical refunds (prod has legitimate
-- multi-completed rows that must stay auditable).
UPDATE refunds r
SET refund_status = 'failed',
    rejection_reason = COALESCE(NULLIF(BTRIM(r.rejection_reason), ''), 'superseded_active_refund')
WHERE r.payment_id IS NOT NULL
  AND LOWER(COALESCE(r.refund_status, '')) IN ('pending', 'processing')
  AND r.id NOT IN (
    SELECT DISTINCT ON (x.payment_id) x.id
    FROM refunds x
    WHERE x.payment_id IS NOT NULL
      AND LOWER(COALESCE(x.refund_status, '')) IN ('pending', 'processing')
    ORDER BY x.payment_id, x.requested_at DESC NULLS LAST, x.id DESC
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_one_active_per_booking
  ON payments (booking_id)
  WHERE booking_id IS NOT NULL
    AND LOWER(COALESCE(payment_status, '')) IN ('pending', 'processing');

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_one_active_per_shop_order
  ON payments (order_id)
  WHERE order_id IS NOT NULL
    AND booking_id IS NULL
    AND pharmacy_order_id IS NULL
    AND LOWER(COALESCE(payment_status, '')) IN ('pending', 'processing');

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_razorpay_order_id_unique
  ON payments (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL
    AND BTRIM(razorpay_order_id) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_refunds_one_active_per_payment
  ON refunds (payment_id)
  WHERE payment_id IS NOT NULL
    AND LOWER(COALESCE(refund_status, '')) IN ('pending', 'processing');

CREATE TABLE IF NOT EXISTS razorpay_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT,
  payment_id UUID,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  result TEXT
);

COMMENT ON TABLE razorpay_webhook_events IS
  'Razorpay webhook event id dedupe. Replay must not create a second business action.';

COMMENT ON INDEX idx_payments_one_active_per_booking IS
  'At most one payable (pending/processing) payment attempt per booking.';

COMMENT ON INDEX idx_payments_one_active_per_shop_order IS
  'At most one payable (pending/processing) payment attempt per ecommerce order.';
