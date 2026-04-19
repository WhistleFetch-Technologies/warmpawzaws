-- ============================================================================
-- WALLET_CHECKOUT_RULES — checkout minimum wallet balance
-- ============================================================================
-- See migration 724_wallet_checkout_min_balance.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS wallet_checkout_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    enabled BOOLEAN NOT NULL DEFAULT true,
    respect_loyalty_redeem_floor BOOLEAN NOT NULL DEFAULT true,
    min_balance_inr_override NUMERIC(12, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS wallet_checkout_rules_one_active
    ON wallet_checkout_rules ((1))
    WHERE is_active = true;
