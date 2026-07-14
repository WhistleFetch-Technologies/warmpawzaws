-- ============================================================================
-- MIGRATION 1067: vendor_earnings settlement metadata (Finance S2)
-- Renumbered from 1058 — develop owns 1058_vendor_return_policy_text.sql
-- ============================================================================
-- Stores funding-aware settlement snapshot at accrual time — Finance source of truth.
-- ============================================================================

ALTER TABLE vendor_earnings
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN vendor_earnings.metadata IS
  'Funding-aware settlement snapshot: commission base, funding summary, tier, policy fingerprint';

CREATE INDEX IF NOT EXISTS idx_vendor_earnings_metadata_gin
  ON vendor_earnings USING gin (metadata);
