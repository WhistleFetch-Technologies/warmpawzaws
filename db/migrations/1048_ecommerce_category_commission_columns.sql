-- ============================================================================
-- MIGRATION 1048: Ecommerce category default commission + order commission audit
-- ============================================================================
-- Purpose: Persist per-category default commission rate; audit commission on orders
-- ============================================================================

ALTER TABLE ecommerce_categories
  ADD COLUMN IF NOT EXISTS default_commission_rate NUMERIC(5, 2);

COMMENT ON COLUMN ecommerce_categories.default_commission_rate IS
  'Platform-wide default commission % for this category; overridden by vendor-specific rules';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(10, 2);

COMMENT ON COLUMN orders.commission_rate IS 'Resolved effective commission % at payment time';
COMMENT ON COLUMN orders.commission_amount IS 'Platform commission amount in INR at payment time';
