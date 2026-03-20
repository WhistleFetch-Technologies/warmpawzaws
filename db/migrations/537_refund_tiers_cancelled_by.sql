-- ============================================================================
-- MIGRATION 537: Refund Tier – Who cancels (pet parent vs provider)
-- ============================================================================
-- Purpose: Add cancelled_by to vendor_refund_tiers so policies can be scoped
-- by who cancels the booking: Pet Parent/Customer or Service Provider/Platform.
-- ============================================================================

ALTER TABLE vendor_refund_tiers
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT;

COMMENT ON COLUMN vendor_refund_tiers.cancelled_by IS 'Who cancels: any (default), pet_parent (customer), provider (service provider/platform). Used to apply different refund rules by canceller.';

CREATE INDEX IF NOT EXISTS idx_vendor_refund_tiers_cancelled_by ON vendor_refund_tiers(cancelled_by) WHERE cancelled_by IS NOT NULL;
