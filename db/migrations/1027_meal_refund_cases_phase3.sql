-- Phase 3: Meal refund cases — Razorpay execution + refunds linkage.

DO $$
BEGIN
  ALTER TABLE meal_refund_cases DROP CONSTRAINT IF EXISTS meal_refund_cases_status_check;
  ALTER TABLE meal_refund_cases ADD CONSTRAINT meal_refund_cases_status_check
    CHECK (status IN (
      'pending_review',
      'approved',
      'rejected',
      'refund_processing',
      'refunded',
      'refund_failed'
    ));
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'meal_refund_cases status check: %', SQLERRM;
END $$;

ALTER TABLE meal_refund_cases
  ADD COLUMN IF NOT EXISTS refunds_row_id UUID REFERENCES refunds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS razorpay_refund_id TEXT,
  ADD COLUMN IF NOT EXISTS refund_amount_executed NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS refund_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS payout_method TEXT;

CREATE INDEX IF NOT EXISTS idx_meal_refund_cases_refunds_row_id
  ON meal_refund_cases (refunds_row_id)
  WHERE refunds_row_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meal_refund_cases_razorpay_refund_id
  ON meal_refund_cases (razorpay_refund_id)
  WHERE razorpay_refund_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'refunds' AND column_name = 'meal_refund_case_id'
  ) THEN
    ALTER TABLE refunds
      ADD COLUMN meal_refund_case_id UUID REFERENCES meal_refund_cases(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_refunds_meal_refund_case_id
      ON refunds (meal_refund_case_id)
      WHERE meal_refund_case_id IS NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN meal_refund_cases.refunds_row_id IS 'refunds table row created for Razorpay/wallet execution';
COMMENT ON COLUMN meal_refund_cases.razorpay_refund_id IS 'Razorpay refund entity id when gateway slice used';
COMMENT ON TABLE meal_refund_cases IS
  'Admin meal refund review + execution; approved flows run via meal-order-original-refund and webhooks reconcile terminal status.';
