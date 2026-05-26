-- Align delivery_settlements with pharmacy/meal settlement inserts (convenience_fee, tier audit columns).

ALTER TABLE delivery_settlements ADD COLUMN IF NOT EXISTS convenience_fee NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE delivery_settlements ADD COLUMN IF NOT EXISTS tier_name VARCHAR(100);
ALTER TABLE delivery_settlements ADD COLUMN IF NOT EXISTS tier_level INTEGER;

COMMENT ON COLUMN delivery_settlements.convenience_fee IS 'Convenience fee deducted from commissionable base (mirrors pharmacy_orders / meal_orders)';
COMMENT ON COLUMN delivery_settlements.tier_name IS 'Vendor tier name used for commission_rate';
COMMENT ON COLUMN delivery_settlements.tier_level IS 'Vendor tier level when applicable';
