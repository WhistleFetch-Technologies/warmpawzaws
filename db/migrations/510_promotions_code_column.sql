-- ============================================================================
-- MIGRATION 510: Add code column to promotions for /promotions/validate
-- ============================================================================
-- Purpose: Promotions table must have code for coupon-style validation in booking/checkout
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promotions' AND column_name = 'code') THEN
        ALTER TABLE promotions ADD COLUMN code VARCHAR(50) UNIQUE;
        COMMENT ON COLUMN promotions.code IS 'Promotion/coupon code for customer-facing validation (e.g. SAVE20)';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code) WHERE code IS NOT NULL;
