-- ============================================================================
-- 1113_wallet_promo_cashback_ledger.sql
-- Promo cashback metadata on existing wallet_transactions (HLD §34 / plan §4.3)
-- Additive columns only. Never credit on evaluate — commit writes these.
-- ============================================================================

ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS promotion_id UUID NULL;

ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS source TEXT NULL;

ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC NULL;

ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS earned_at TIMESTAMPTZ NULL;

ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL;

ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS cashback_status TEXT NULL;

ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS redeem_scope JSONB NULL;

-- Live wallet_transactions is keyed by wallet_id (001 schema), not customer_id.
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_promo_cashback
  ON wallet_transactions (wallet_id, cashback_status, expires_at)
  WHERE source = 'PROMOTION';

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_promotion_id
  ON wallet_transactions (promotion_id)
  WHERE promotion_id IS NOT NULL;

COMMENT ON COLUMN wallet_transactions.promotion_id IS 'Promo engine cashback source promotion';
COMMENT ON COLUMN wallet_transactions.source IS 'e.g. PROMOTION for engine cashback credits';
COMMENT ON COLUMN wallet_transactions.remaining_amount IS 'Unredeemed cashback remaining';
COMMENT ON COLUMN wallet_transactions.cashback_status IS 'AVAILABLE|PARTIALLY_USED|USED|EXPIRED|REVERSED';
COMMENT ON COLUMN wallet_transactions.redeem_scope IS '{"services":["VET","TRAINING",…]}';
