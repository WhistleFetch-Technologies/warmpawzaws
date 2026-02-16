-- ============================================================================
-- MIGRATION 554: Add Missing Columns to loyalty_rules Table
-- ============================================================================
-- Date: 2026-02-16
-- Purpose: Add name, description, min_points_to_redeem, max_redemption_per_transaction, and expiry_days columns
--          to match backend API expectations
-- ============================================================================

-- Add 'name' column (backend expects 'name' instead of 'rule_name')
ALTER TABLE loyalty_rules 
ADD COLUMN IF NOT EXISTS name TEXT;

-- Populate 'name' from 'rule_name' for existing records
UPDATE loyalty_rules 
SET name = rule_name 
WHERE name IS NULL AND rule_name IS NOT NULL;

-- Make 'name' NOT NULL and UNIQUE after populating
-- First, ensure no duplicates
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM loyalty_rules 
        WHERE name IS NULL 
        OR (SELECT COUNT(*) FROM loyalty_rules GROUP BY name HAVING COUNT(*) > 1) > 0
    ) THEN
        RAISE NOTICE 'Warning: Some loyalty_rules have NULL name or duplicates. Please review.';
    END IF;
END $$;

-- Add 'description' column
ALTER TABLE loyalty_rules 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add 'min_points_to_redeem' column (backend expects this name, table has 'min_redemption_points')
ALTER TABLE loyalty_rules 
ADD COLUMN IF NOT EXISTS min_points_to_redeem INTEGER;

-- Populate 'min_points_to_redeem' from 'min_redemption_points' for existing records
UPDATE loyalty_rules 
SET min_points_to_redeem = min_redemption_points 
WHERE min_points_to_redeem IS NULL AND min_redemption_points IS NOT NULL;

-- Set default if still NULL
UPDATE loyalty_rules 
SET min_points_to_redeem = 100 
WHERE min_points_to_redeem IS NULL;

-- Add 'max_redemption_per_transaction' column
ALTER TABLE loyalty_rules 
ADD COLUMN IF NOT EXISTS max_redemption_per_transaction INTEGER;

-- Add 'expiry_days' column
ALTER TABLE loyalty_rules 
ADD COLUMN IF NOT EXISTS expiry_days INTEGER;

-- Add comments
COMMENT ON COLUMN loyalty_rules.name IS 'Rule name (alias for rule_name, used by admin API)';
COMMENT ON COLUMN loyalty_rules.description IS 'Rule description';
COMMENT ON COLUMN loyalty_rules.min_points_to_redeem IS 'Minimum points required to redeem (alias for min_redemption_points)';
COMMENT ON COLUMN loyalty_rules.max_redemption_per_transaction IS 'Maximum points that can be redeemed per transaction (NULL = unlimited)';
COMMENT ON COLUMN loyalty_rules.expiry_days IS 'Number of days after which points expire (NULL = never expire)';
