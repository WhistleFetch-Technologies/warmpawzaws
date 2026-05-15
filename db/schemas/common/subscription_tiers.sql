-- ============================================================================
-- SUBSCRIPTION_TIERS TABLE - SCHEMA
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_tiers (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tier_name TEXT NOT NULL,
    tier_level INTEGER NOT NULL,
    monthly_price NUMERIC(10, 2) NOT NULL,
    features JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT subscription_tiers_tier_name_key UNIQUE (tier_name),
    CONSTRAINT subscription_tiers_tier_level_key UNIQUE (tier_level)
);

CREATE UNIQUE INDEX subscription_tiers_pkey ON subscription_tiers(id);
CREATE UNIQUE INDEX subscription_tiers_tier_name_key ON subscription_tiers(tier_name);
CREATE UNIQUE INDEX subscription_tiers_tier_level_key ON subscription_tiers(tier_level);
CREATE INDEX idx_subscription_tiers_active ON subscription_tiers(is_active) WHERE is_active = true;

COMMENT ON TABLE subscription_tiers IS 'Subscription tiers - maps from subscription_tiers:all, payment:tiers KV keys';
