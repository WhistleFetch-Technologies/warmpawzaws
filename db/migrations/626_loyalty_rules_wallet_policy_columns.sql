-- ============================================================================
-- 626: loyalty_rules — wallet policy columns (dev / migration 043 parity)
-- ============================================================================
-- Prod historically lacked these; apply-prod-loyalty-dev-parity.js ran on prod.
-- Idempotent for any environment missing the columns.
-- ============================================================================

ALTER TABLE loyalty_rules ADD COLUMN IF NOT EXISTS auto_convert_to_wallet BOOLEAN DEFAULT true;
ALTER TABLE loyalty_rules ADD COLUMN IF NOT EXISTS conversion_rate NUMERIC(5, 2) DEFAULT 1.0;

COMMENT ON COLUMN loyalty_rules.auto_convert_to_wallet IS 'When true, earn path credits wallet using redemption_rate (points per rupee)';
COMMENT ON COLUMN loyalty_rules.conversion_rate IS 'Legacy/auxiliary rate field; earn path uses redemption_rate for wallet credit';
