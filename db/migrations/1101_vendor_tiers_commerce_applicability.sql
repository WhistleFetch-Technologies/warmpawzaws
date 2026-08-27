-- ============================================================================
-- MIGRATION 1101: Vendor tiers — Marketplace / Warmpawz Pay applicability
-- ============================================================================
-- Additive. Existing rows default to marketplace_enabled=true, warmpawz_pay_enabled=false.
-- is_default remains a single global default (do not split by commerce mode).
-- Idempotent: safe to re-run
-- ============================================================================

ALTER TABLE vendor_tiers
  ADD COLUMN IF NOT EXISTS marketplace_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE vendor_tiers
  ADD COLUMN IF NOT EXISTS warmpawz_pay_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN vendor_tiers.marketplace_enabled IS
  'When true, tier is available to Marketplace screens and vendor onboarding.';

COMMENT ON COLUMN vendor_tiers.warmpawz_pay_enabled IS
  'When true, tier may be selected on Warmpawz Pay vendor publishing.';
