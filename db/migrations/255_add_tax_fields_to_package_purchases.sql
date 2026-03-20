-- ============================================================================
-- MIGRATION 255: Add Tax Fields to Package Purchases
-- ============================================================================
-- Purpose: Add tax calculation fields to package_purchases table
-- Date: 2026-01-25
-- ============================================================================

BEGIN;

-- Add tax fields to package_purchases table
ALTER TABLE package_purchases ADD COLUMN IF NOT EXISTS 
    tax_rate DECIMAL(5, 2) DEFAULT 18.00;

ALTER TABLE package_purchases ADD COLUMN IF NOT EXISTS 
    tax_amount NUMERIC(10, 2) DEFAULT 0;

ALTER TABLE package_purchases ADD COLUMN IF NOT EXISTS 
    total_with_tax NUMERIC(10, 2);

ALTER TABLE package_purchases ADD COLUMN IF NOT EXISTS 
    settlement_id UUID REFERENCES settlements(id);

-- Update existing records to calculate tax if amount exists
UPDATE package_purchases
SET 
    tax_rate = 18.00,
    tax_amount = ROUND((amount * 18.00) / 100, 2),
    total_with_tax = amount + ROUND((amount * 18.00) / 100, 2)
WHERE tax_amount IS NULL OR tax_amount = 0
AND amount > 0;

-- Add index for settlement lookup
CREATE INDEX IF NOT EXISTS idx_package_purchases_settlement 
ON package_purchases(settlement_id) 
WHERE settlement_id IS NOT NULL;

COMMENT ON COLUMN package_purchases.tax_rate IS 'GST rate applied (default 18% for India)';
COMMENT ON COLUMN package_purchases.tax_amount IS 'Tax amount calculated on package price';
COMMENT ON COLUMN package_purchases.total_with_tax IS 'Total amount including tax';
COMMENT ON COLUMN package_purchases.settlement_id IS 'Reference to settlement record when package purchase is settled';

COMMIT;
