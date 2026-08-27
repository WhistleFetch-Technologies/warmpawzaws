-- ============================================================================
-- MIGRATION 1102: WPay merchant pricing — selected vendor_tiers row
-- ============================================================================
-- Additive. Does NOT convert historical platform_withhold_percent into commission.
-- tier_id IS NULL means the row still uses the old withhold commercial model.
-- Idempotent: safe to re-run
-- ============================================================================

ALTER TABLE warmpawz_pay_merchant_pricing
  ADD COLUMN IF NOT EXISTS tier_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'warmpawz_pay_merchant_pricing_tier_id_fkey'
  ) THEN
    ALTER TABLE warmpawz_pay_merchant_pricing
      ADD CONSTRAINT warmpawz_pay_merchant_pricing_tier_id_fkey
      FOREIGN KEY (tier_id) REFERENCES vendor_tiers(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wpay_merchant_pricing_tier_id
  ON warmpawz_pay_merchant_pricing (tier_id);

COMMENT ON COLUMN warmpawz_pay_merchant_pricing.tier_id IS
  'WPay-enabled vendor_tiers row whose commission_rate is inherited. NULL = historical withhold config.';
