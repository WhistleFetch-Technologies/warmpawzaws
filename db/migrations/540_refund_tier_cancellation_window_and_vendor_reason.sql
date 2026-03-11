-- Migration 540: Refund tier condition by who cancels – customer time windows vs vendor reasons.
-- Customer tiers: cancellation_window (24_plus, 12_24, under_12_no_show, etc.).
-- Provider tiers: vendor_cancellation_reason (emergency, operational, technical).
-- hours_before_service kept for backward compatibility; derived from window when saving customer tier.

ALTER TABLE vendor_refund_tiers
  ADD COLUMN IF NOT EXISTS cancellation_window TEXT;

ALTER TABLE vendor_refund_tiers
  ADD COLUMN IF NOT EXISTS vendor_cancellation_reason TEXT;

COMMENT ON COLUMN vendor_refund_tiers.cancellation_window IS 'For pet_parent: 24_plus, 12_24, under_12_no_show, 12_plus, 6_12, under_6_no_show, 48_plus, 24_48, under_24_no_show, after_checkin, did_not_join_video. NULL for provider tiers.';
COMMENT ON COLUMN vendor_refund_tiers.vendor_cancellation_reason IS 'For provider: emergency, operational, technical. NULL for pet_parent tiers.';

CREATE INDEX IF NOT EXISTS idx_vendor_refund_tiers_cancellation_window ON vendor_refund_tiers(cancellation_window) WHERE cancellation_window IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendor_refund_tiers_vendor_reason ON vendor_refund_tiers(vendor_cancellation_reason) WHERE vendor_cancellation_reason IS NOT NULL;
