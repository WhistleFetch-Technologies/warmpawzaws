-- ============================================================================
-- 542 PROD: Add terms columns to vendor_tiers only (no vendor_tier_acceptances)
-- ============================================================================
-- Use when vendor_tier_subscriptions does not exist on target (e.g. prod).
-- Full 542 also creates vendor_tier_acceptances which references that table.
-- ============================================================================

ALTER TABLE vendor_tiers
  ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS terms_version TEXT DEFAULT '1.0';

COMMENT ON COLUMN vendor_tiers.terms_and_conditions IS 'Terms and conditions for this tier - vendor must accept before upgrade';
COMMENT ON COLUMN vendor_tiers.terms_version IS 'Version of terms for audit trail';
