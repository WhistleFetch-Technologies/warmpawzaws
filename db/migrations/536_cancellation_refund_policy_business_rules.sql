-- ============================================================================
-- MIGRATION 536: Cancellation & Refund Policy – Business Rules (Warmpawz)
-- ============================================================================
-- Purpose: Extend cancellation_policies and vendor_refund_tiers to support
-- configurable business rules: cancellation windows, provider cancellation,
-- no-show, service category/format, ecommerce return window.
-- Aligns with: Veterinary, Grooming, Walkers/Training/Boarding, Ecommerce policies.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- CANCELLATION POLICIES: windows, penalty, no-show, service category/format
-- ----------------------------------------------------------------------------
ALTER TABLE cancellation_policies
  ADD COLUMN IF NOT EXISTS cancellation_windows JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS vendor_cancellation_penalty JSONB DEFAULT '{"enabled":true,"penaltyPercentage":10,"compensationPercentage":50}',
  ADD COLUMN IF NOT EXISTS no_show_policy JSONB DEFAULT '{"enabled":true,"refundPercentage":0,"penaltyAmount":0}',
  ADD COLUMN IF NOT EXISTS service_category TEXT,
  ADD COLUMN IF NOT EXISTS service_format TEXT;

-- Allow legacy single-window; new policies use cancellation_windows
COMMENT ON COLUMN cancellation_policies.cancellation_windows IS 'Array of {hoursBefore, refundPercentage, cancellationFee, penaltyPercentage, allowReschedule, maxReschedules}. Empty = use legacy hours_before_booking/cancellation_fee_percentage';
COMMENT ON COLUMN cancellation_policies.vendor_cancellation_penalty IS 'When provider cancels: {enabled, penaltyPercentage, compensationPercentage}';
COMMENT ON COLUMN cancellation_policies.no_show_policy IS 'No-show: {enabled, refundPercentage, penaltyAmount}';
COMMENT ON COLUMN cancellation_policies.service_category IS 'Optional: veterinary, grooming, walkers_training_boarding, ecommerce. For display and matching.';
COMMENT ON COLUMN cancellation_policies.service_format IS 'Optional: in_clinic, teleconsultation, doorstep, centre. For display and matching.';

-- Optional constraint for service_category / service_format (platform-defined)
-- No CHECK here so platform can add values via admin_settings or config

CREATE INDEX IF NOT EXISTS idx_cancellation_policies_service_category ON cancellation_policies(service_category) WHERE service_category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cancellation_policies_service_format ON cancellation_policies(service_format) WHERE service_format IS NOT NULL;

-- ----------------------------------------------------------------------------
-- VENDOR REFUND TIERS: max partial refund % (e.g. 50% for doorstep)
-- ----------------------------------------------------------------------------
ALTER TABLE vendor_refund_tiers
  ADD COLUMN IF NOT EXISTS max_partial_refund_percentage NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS service_category TEXT,
  ADD COLUMN IF NOT EXISTS service_format TEXT;

COMMENT ON COLUMN vendor_refund_tiers.max_partial_refund_percentage IS 'Cap on partial refund % (e.g. 50 for doorstep travel deduction). NULL = no cap';
COMMENT ON COLUMN vendor_refund_tiers.service_category IS 'Optional: veterinary, grooming, walkers_training_boarding. For display and matching.';
COMMENT ON COLUMN vendor_refund_tiers.service_format IS 'Optional: in_clinic, teleconsultation, doorstep, centre.';

-- ----------------------------------------------------------------------------
-- ECOMMERCE POLICIES: return window (hours), cancel before dispatch
-- ----------------------------------------------------------------------------
ALTER TABLE ecommerce_policies
  ADD COLUMN IF NOT EXISTS return_window_hours INTEGER DEFAULT 48,
  ADD COLUMN IF NOT EXISTS cancel_before_dispatch_full_refund BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS non_returnable_categories TEXT[] DEFAULT '{}';

COMMENT ON COLUMN ecommerce_policies.return_window_hours IS 'Return/replacement request must be raised within this many hours of delivery (e.g. 48)';
COMMENT ON COLUMN ecommerce_policies.cancel_before_dispatch_full_refund IS 'If true, order cancelled before dispatch gets full refund';
COMMENT ON COLUMN ecommerce_policies.non_returnable_categories IS 'e.g. opened_pet_food, supplements, hygiene_once_opened, customized, clearance';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
