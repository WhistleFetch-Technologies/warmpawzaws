-- ============================================================================
-- MIGRATION 1123: Vendor feedback card (customer home bottom sheet)
-- Lets customers review the vendor of their most recent completed transaction:
-- appointment (at home / at clinic), teleconsultation, or Warmpawz Pay bill.
--   reviews.payment_id     — Warmpawz Pay bill reviewed (booking_id stays NULL
--                            unless the bill paid for a booking)
--   reviews.source_type    — at_home | at_clinic | tele | warmpawz_pay
--   reviews.transaction_at — when the reviewed service / payment completed
--   customer_feedback_prompts — one row per transaction the customer reviewed
--                            or dismissed ("Continue to Home"), so the sheet
--                            never asks twice for the same transaction.
-- Additive and idempotent.
-- ============================================================================

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS transaction_at TIMESTAMPTZ;

-- One review per booking / per payment. Skipped (with a notice) if legacy
-- duplicates exist so the migration never fails on old data.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM reviews WHERE booking_id IS NOT NULL
    GROUP BY booking_id HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_booking_id
      ON reviews (booking_id) WHERE booking_id IS NOT NULL;
  ELSE
    RAISE NOTICE 'uq_reviews_booking_id skipped: duplicate reviews per booking exist';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_payment_id
  ON reviews (payment_id) WHERE payment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS customer_feedback_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('booking', 'payment')),
  source_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('dismissed', 'submitted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_customer_feedback_prompts_source UNIQUE (customer_id, source_type, source_id)
);

-- Latest completed transaction per customer (prompt lookup is LIMIT 1 on these).
CREATE INDEX IF NOT EXISTS idx_bookings_customer_completed_at
  ON bookings (customer_id, completed_at DESC)
  WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_payments_wpay_customer_completed_at
  ON payments (customer_id, completed_at DESC)
  WHERE payment_source = 'warmpawz_pay' AND payment_status = 'completed';
