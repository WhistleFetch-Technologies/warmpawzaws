-- ============================================================================
-- Migration 1126: Promotion Engine global settings + per-customer benefit cap
-- ============================================================================
-- One global settings row (id = 1). benefit_cap limits how many benefit
-- payments (promo discount, promo cashback, or wallet spend) one customer can
-- make inside a configurable window. It is a gate in front of the engine and
-- does not change promotions, ranges, limits or visit counting.
-- Seeded DISABLED so deploying this migration changes nothing until an admin
-- turns the cap on.
-- Additive + idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS promo_engine_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  benefit_cap JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT promo_engine_settings_singleton CHECK (id = 1)
);

INSERT INTO promo_engine_settings (id, benefit_cap)
VALUES (
  1,
  '{
    "enabled": false,
    "max_benefit_payments": 3,
    "window_type": "calendar",
    "window_length": 1,
    "window_unit": "days",
    "reset_time": "00:00",
    "block": "both",
    "waive_platform_fee": true,
    "message": null
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Counting benefit payments per customer inside the window.
CREATE INDEX IF NOT EXISTS idx_promo_engine_usage_user_live
  ON promo_engine_usage (user_id, created_at DESC)
  WHERE reversed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_debit_created
  ON wallet_transactions (wallet_id, created_at DESC)
  WHERE transaction_type = 'debit';

COMMENT ON TABLE promo_engine_settings IS
  'Promotion Engine global settings (single row). benefit_cap = per-customer benefit payment cap per window.';
