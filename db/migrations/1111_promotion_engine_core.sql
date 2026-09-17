-- ============================================================================
-- 1111_promotion_engine_core.sql
-- Promotion Engine v1 core tables (HLD §33 / master plan §4.1)
-- Additive + idempotent. Do not DROP. Dev-only apply until Phase 5.
-- ============================================================================

CREATE TABLE IF NOT EXISTS promo_engine_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'EXPIRED', 'ARCHIVED')),
  priority INT NOT NULL DEFAULT 50,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  stacking_policy TEXT
    CHECK (stacking_policy IS NULL OR stacking_policy IN (
      'NONE', 'ORDER_LEVEL', 'SERVICE_LEVEL', 'CATEGORY_LEVEL',
      'DISCOUNT_WITH_CASHBACK', 'FULL_STACKING'
    )),
  funding_type TEXT
    CHECK (funding_type IS NULL OR funding_type IN ('WARMPAWZ', 'VENDOR', 'SHARED')),
  funding_split JSONB,
  budget_limit NUMERIC,
  budget_consumed NUMERIC NOT NULL DEFAULT 0,
  commercial_campaign_id UUID,
  service_categories TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'promo_engine_promotions_campaign_fkey'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'commercial_discount_campaigns'
  ) THEN
    ALTER TABLE promo_engine_promotions
      ADD CONSTRAINT promo_engine_promotions_campaign_fkey
      FOREIGN KEY (commercial_campaign_id)
      REFERENCES commercial_discount_campaigns(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_promo_engine_promotions_status_window
  ON promo_engine_promotions (status, start_at, end_at);

CREATE INDEX IF NOT EXISTS idx_promo_engine_promotions_service_categories
  ON promo_engine_promotions USING GIN (service_categories);

CREATE INDEX IF NOT EXISTS idx_promo_engine_promotions_campaign
  ON promo_engine_promotions (commercial_campaign_id)
  WHERE commercial_campaign_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS promo_engine_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES promo_engine_promotions(id) ON DELETE CASCADE,
  priority INT NOT NULL DEFAULT 100,
  condition_json JSONB NOT NULL,
  benefit_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  rule_type TEXT NOT NULL DEFAULT 'GENERIC'
    CHECK (rule_type IN ('GENERIC', 'CUSTOMER_JOURNEY')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_engine_rules_promotion
  ON promo_engine_rules (promotion_id, priority);

CREATE TABLE IF NOT EXISTS promo_engine_limits (
  promotion_id UUID PRIMARY KEY REFERENCES promo_engine_promotions(id) ON DELETE CASCADE,
  per_user INT,
  per_transaction INT,
  daily_limit INT,
  campaign_limit INT,
  budget_limit NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_engine_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES promo_engine_promotions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL DEFAULT 'BOOKING',
  evaluation_id UUID,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  cashback_amount NUMERIC NOT NULL DEFAULT 0,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_engine_usage_idempotency
  ON promo_engine_usage (idempotency_key);

CREATE INDEX IF NOT EXISTS idx_promo_engine_usage_promo_user
  ON promo_engine_usage (promotion_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_promo_engine_usage_transaction
  ON promo_engine_usage (transaction_type, transaction_id);

COMMENT ON TABLE promo_engine_promotions IS 'Promotion Engine v1 campaign object (distinct from legacy promotions)';
COMMENT ON TABLE promo_engine_rules IS 'IF condition_json THEN benefit_json; journey templates compile to CUSTOMER_JOURNEY';
COMMENT ON TABLE promo_engine_limits IS 'Per-promotion usage and budget caps';
COMMENT ON TABLE promo_engine_usage IS 'Committed applications; idempotency_key = promotion_id + transaction_id + benefit_id';
COMMENT ON COLUMN promo_engine_promotions.service_categories IS 'Denormalized from rule conditions for candidate filter';
