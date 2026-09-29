-- ============================================================================
-- Migration 1119: Promotion Engine usage reversal marker
-- ============================================================================
-- Refunds / reversals flip reversed_at so usage limits (per user, daily,
-- campaign) and budget are released. Rows are never deleted.
-- ============================================================================

ALTER TABLE promo_engine_usage
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_promo_engine_usage_live_promo
  ON promo_engine_usage (promotion_id, created_at DESC)
  WHERE reversed_at IS NULL;

COMMENT ON COLUMN promo_engine_usage.reversed_at IS
  'Set when the transaction is reversed/refunded; reversed rows do not count toward limits';
