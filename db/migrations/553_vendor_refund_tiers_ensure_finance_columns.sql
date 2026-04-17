-- ============================================================================
-- Migration 553: Ensure vendor_refund_tiers has all columns used by Admin
-- Finance → Cancellation & Refund Policy (Lambda mapRefundTierBodyToDb).
-- ============================================================================
-- Run on PROD if you see: column "cancelled_by" of relation "vendor_refund_tiers"
-- does not exist (or similar for cancellation_window, policy_extensions, etc.).
-- Idempotent: safe to run when some of 536–542 were already applied.
-- Combines: 536 (partial), 537, 539, 540, 541, 542 for this table only.
-- ============================================================================

-- 536 — business rule columns
ALTER TABLE vendor_refund_tiers
  ADD COLUMN IF NOT EXISTS max_partial_refund_percentage NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS service_category TEXT,
  ADD COLUMN IF NOT EXISTS service_format TEXT;

-- 537 / 539 — who cancels (required for tier rows)
ALTER TABLE vendor_refund_tiers
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT;

UPDATE vendor_refund_tiers
SET cancelled_by = 'pet_parent'
WHERE cancelled_by IS NULL OR cancelled_by = 'any';

ALTER TABLE vendor_refund_tiers
  DROP CONSTRAINT IF EXISTS chk_vendor_refund_tiers_cancelled_by;

ALTER TABLE vendor_refund_tiers
  ADD CONSTRAINT chk_vendor_refund_tiers_cancelled_by
  CHECK (cancelled_by IN ('pet_parent', 'provider'));

ALTER TABLE vendor_refund_tiers
  ALTER COLUMN cancelled_by SET DEFAULT 'pet_parent';

ALTER TABLE vendor_refund_tiers
  ALTER COLUMN cancelled_by SET NOT NULL;

COMMENT ON COLUMN vendor_refund_tiers.cancelled_by IS 'Who cancels: pet_parent (customer) or provider (service provider/platform). Required. No any.';

CREATE INDEX IF NOT EXISTS idx_vendor_refund_tiers_cancelled_by ON vendor_refund_tiers(cancelled_by) WHERE cancelled_by IS NOT NULL;

-- 540 — customer windows / vendor reasons
ALTER TABLE vendor_refund_tiers
  ADD COLUMN IF NOT EXISTS cancellation_window TEXT;

ALTER TABLE vendor_refund_tiers
  ADD COLUMN IF NOT EXISTS vendor_cancellation_reason TEXT;

COMMENT ON COLUMN vendor_refund_tiers.cancellation_window IS 'For pet_parent: 24_plus, 12_24, under_12_no_show, etc. NULL for provider tiers.';
COMMENT ON COLUMN vendor_refund_tiers.vendor_cancellation_reason IS 'For provider: emergency, operational, technical. NULL for pet_parent tiers.';

CREATE INDEX IF NOT EXISTS idx_vendor_refund_tiers_cancellation_window ON vendor_refund_tiers(cancellation_window) WHERE cancellation_window IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendor_refund_tiers_vendor_reason ON vendor_refund_tiers(vendor_cancellation_reason) WHERE vendor_cancellation_reason IS NOT NULL;

-- 541 — flexible hours rule
ALTER TABLE vendor_refund_tiers
  ADD COLUMN IF NOT EXISTS hours_operator TEXT;

ALTER TABLE vendor_refund_tiers
  ADD COLUMN IF NOT EXISTS hours_threshold NUMERIC(10, 2);

COMMENT ON COLUMN vendor_refund_tiers.hours_operator IS 'Optional: gte, lte, gt, lt.';
COMMENT ON COLUMN vendor_refund_tiers.hours_threshold IS 'Optional: numeric hours for hours_operator matching.';

CREATE INDEX IF NOT EXISTS idx_vendor_refund_tiers_hours_rule ON vendor_refund_tiers(hours_operator, hours_threshold) WHERE hours_operator IS NOT NULL AND hours_threshold IS NOT NULL;

-- 542 — policy_extensions JSONB
ALTER TABLE vendor_refund_tiers
  ADD COLUMN IF NOT EXISTS policy_extensions JSONB DEFAULT NULL;

COMMENT ON COLUMN vendor_refund_tiers.policy_extensions IS 'Optional JSON: reschedule / no-show / provider policy extensions.';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
