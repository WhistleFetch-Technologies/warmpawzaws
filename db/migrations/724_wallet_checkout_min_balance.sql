-- ============================================================================
-- 724: Wallet checkout minimum balance (aligned with loyalty redeem floor)
-- ============================================================================
-- Effective minimum INR = MAX(
--   loyalty: min_redemption_points / redemption_rate (active loyalty_rules, exactly one row),
--   platform_settings: min_customer_wallet_balance_to_use_checkout_inr,
--   wallet_checkout_rules.min_balance_inr_override
-- ) when wallet_checkout_rules.enabled is true.
-- Credits (refunds, loyalty credit) are unaffected — only booking wallet debits.
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

COMMENT ON TABLE wallet_checkout_rules IS 'Checkout policy: minimum customer wallet balance before applying wallet to bookings';
COMMENT ON COLUMN wallet_checkout_rules.respect_loyalty_redeem_floor IS 'When true, floor includes min_redemption_points/redemption_rate from active loyalty_rules';
COMMENT ON COLUMN wallet_checkout_rules.min_balance_inr_override IS 'Optional extra INR floor (max with loyalty + platform floors)';

CREATE UNIQUE INDEX IF NOT EXISTS wallet_checkout_rules_one_active
    ON wallet_checkout_rules ((1))
    WHERE is_active = true;

INSERT INTO wallet_checkout_rules (is_active, enabled, respect_loyalty_redeem_floor, min_balance_inr_override)
SELECT true, true, true, NULL
WHERE NOT EXISTS (SELECT 1 FROM wallet_checkout_rules WHERE is_active = true);

INSERT INTO platform_settings (setting_key, setting_value, setting_type, description, is_public, created_at, updated_at)
VALUES (
    'min_customer_wallet_balance_to_use_checkout_inr',
    '100'::jsonb,
    'number',
    'Minimum INR wallet balance to use wallet at checkout (combined with loyalty redeem floor via MAX). Use JSON number 0 to rely on loyalty + override only.',
    false,
    NOW(),
    NOW()
)
ON CONFLICT (setting_key) DO NOTHING;
