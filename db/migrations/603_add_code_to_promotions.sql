-- ============================================================================
-- MIGRATION 603: Add code column to promotions table if it doesn't exist
-- ============================================================================
-- Purpose: Ensure promotions table has a code column for coupon-style validation
-- Date: 2026-02-24
-- ============================================================================

DO $$
BEGIN
    -- Add code column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'promotions' AND column_name = 'code'
    ) THEN
        ALTER TABLE promotions ADD COLUMN code VARCHAR(50);
        COMMENT ON COLUMN promotions.code IS 'Promotion/coupon code for customer-facing validation (e.g. SAVE20)';
        RAISE NOTICE 'Added code column to promotions table.';
    ELSE
        RAISE NOTICE 'code column already exists in promotions table.';
    END IF;

    -- Create index if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_promotions_code'
    ) THEN
        CREATE INDEX idx_promotions_code ON promotions(code) WHERE code IS NOT NULL;
        RAISE NOTICE 'Created index on promotions.code.';
    ELSE
        RAISE NOTICE 'Index idx_promotions_code already exists.';
    END IF;

EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Migration 603_add_code_to_promotions.sql failed: %', SQLERRM;
END $$;
