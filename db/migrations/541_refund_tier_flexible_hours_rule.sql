-- Migration 541: Optional flexible hours rule per refund tier (operator + threshold).
-- When set, tier matches when hoursUntilBooking satisfies the operator (e.g. gte + 24 = "24+ hours").
-- When NULL, existing cancellation_window / hours_before_service behaviour is used.
-- Operators: gte (>=), lte (<=), gt (>), lt (<).

ALTER TABLE vendor_refund_tiers
  ADD COLUMN IF NOT EXISTS hours_operator TEXT;

ALTER TABLE vendor_refund_tiers
  ADD COLUMN IF NOT EXISTS hours_threshold NUMERIC(10, 2);

COMMENT ON COLUMN vendor_refund_tiers.hours_operator IS 'Optional: gte, lte, gt, lt. When set with hours_threshold, tier applies when hoursUntilBooking op threshold.';
COMMENT ON COLUMN vendor_refund_tiers.hours_threshold IS 'Optional: numeric hours. Used with hours_operator for flexible "≥ X hours" / "< X hours" rules.';

CREATE INDEX IF NOT EXISTS idx_vendor_refund_tiers_hours_rule ON vendor_refund_tiers(hours_operator, hours_threshold) WHERE hours_operator IS NOT NULL AND hours_threshold IS NOT NULL;
