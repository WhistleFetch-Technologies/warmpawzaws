-- ============================================================================
-- MIGRATION 753: vendor_daily_accrual — meal/pharmacy delivery_settlements columns
-- ============================================================================

ALTER TABLE vendor_daily_accrual
  ADD COLUMN IF NOT EXISTS delivery_settlement_line_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE vendor_daily_accrual
  ADD COLUMN IF NOT EXISTS missing_delivery_settlement_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN vendor_daily_accrual.delivery_settlement_line_count IS
  'Count of delivery_settlements credited on report_date (IST via order_delivered_at).';

COMMENT ON COLUMN vendor_daily_accrual.missing_delivery_settlement_count IS
  'Delivered meal_orders that day (IST) with no delivery_settlements row.';
