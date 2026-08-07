-- ============================================================================
-- MIGRATION 1093: Warmpawz Pay — platform withhold percent on merchant pricing
-- ============================================================================
-- Purpose: Admin-configurable platform withhold % applied to customer paid amount
--          at Pay Bill settlement accrual (see wappt_pay_settlement plan S01/S03).
-- Idempotent: safe to re-run
-- Additive only
-- ============================================================================

ALTER TABLE warmpawz_pay_merchant_pricing
  ADD COLUMN IF NOT EXISTS platform_withhold_percent NUMERIC(5, 2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'warmpawz_pay_merchant_pricing'::regclass
      AND conname = 'warmpawz_pay_merchant_pricing_platform_withhold_percent_check'
  ) THEN
    ALTER TABLE warmpawz_pay_merchant_pricing
      ADD CONSTRAINT warmpawz_pay_merchant_pricing_platform_withhold_percent_check
      CHECK (platform_withhold_percent >= 0 AND platform_withhold_percent <= 100);
  END IF;
END $$;

COMMENT ON COLUMN warmpawz_pay_merchant_pricing.platform_withhold_percent IS
  'Platform withhold percentage (0-100) on Pay Bill customer paid amount; admin-only.';
