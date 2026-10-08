-- ============================================================================
-- Migration 1125: Promotion Engine bill-amount ranges
-- ============================================================================
-- Each promo_engine_rules row is one bill-amount range of its promotion.
-- A bill matches when min_amount <= amount <= max_amount (NULL = open side);
-- a bill exactly on a shared boundary belongs to the lower range.
-- NULL range columns fall back to promotion-level settings, so existing
-- single-rule promotions behave exactly as before.
-- Additive + idempotent. Ranges are archived (archived_at), never deleted,
-- so usage rows keep their rule_id.
-- ============================================================================

ALTER TABLE promo_engine_rules
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INT,
  ADD COLUMN IF NOT EXISTS min_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS max_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS benefit_mode TEXT,
  ADD COLUMN IF NOT EXISTS customer_copy JSONB,
  ADD COLUMN IF NOT EXISTS per_user_limit INT,
  ADD COLUMN IF NOT EXISTS daily_limit INT,
  ADD COLUMN IF NOT EXISTS campaign_limit INT,
  ADD COLUMN IF NOT EXISTS budget_limit NUMERIC,
  ADD COLUMN IF NOT EXISTS budget_consumed NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'promo_engine_rules_benefit_mode_check'
  ) THEN
    ALTER TABLE promo_engine_rules
      ADD CONSTRAINT promo_engine_rules_benefit_mode_check
      CHECK (benefit_mode IS NULL OR benefit_mode IN ('discount', 'cashback', 'both'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'promo_engine_rules_amount_range_check'
  ) THEN
    ALTER TABLE promo_engine_rules
      ADD CONSTRAINT promo_engine_rules_amount_range_check
      CHECK (
        (min_amount IS NULL OR min_amount >= 0)
        AND (max_amount IS NULL OR min_amount IS NULL OR max_amount > min_amount)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_promo_engine_rules_range
  ON promo_engine_rules (promotion_id, sort_order)
  WHERE archived_at IS NULL;

ALTER TABLE promo_engine_usage
  ADD COLUMN IF NOT EXISTS rule_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'promo_engine_usage_rule_fkey'
  ) THEN
    ALTER TABLE promo_engine_usage
      ADD CONSTRAINT promo_engine_usage_rule_fkey
      FOREIGN KEY (rule_id) REFERENCES promo_engine_rules(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_promo_engine_usage_live_rule
  ON promo_engine_usage (rule_id, created_at DESC)
  WHERE reversed_at IS NULL AND rule_id IS NOT NULL;

COMMENT ON COLUMN promo_engine_rules.min_amount IS
  'Bill-amount range floor (inclusive); NULL = no floor';
COMMENT ON COLUMN promo_engine_rules.max_amount IS
  'Bill-amount range ceiling (inclusive; shared boundary goes to the lower range); NULL = no ceiling';
COMMENT ON COLUMN promo_engine_rules.archived_at IS
  'Range removed in admin; kept so usage.rule_id stays valid';
COMMENT ON COLUMN promo_engine_usage.rule_id IS
  'Range (promo_engine_rules row) that produced this usage; NULL for pre-range rows';
