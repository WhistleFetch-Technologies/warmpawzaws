-- ============================================================================
-- MIGRATION: 033_add_check_constraints.sql
-- ============================================================================
-- Phase 3, Task 3.3: Add Check Constraints
-- 
-- Purpose: Add check constraints to ensure data quality and prevent invalid values
-- These constraints enforce business rules at the database level
--
-- Date: 2025-01-27
-- ============================================================================

DO $$
BEGIN
    -- ========================================================================
    -- 1. Ensure booking amounts are positive
    -- ========================================================================
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_booking_amount_positive'
    ) THEN
        ALTER TABLE bookings 
        ADD CONSTRAINT check_booking_amount_positive
        CHECK (total_amount > 0);
        
        RAISE NOTICE 'Added check constraint: check_booking_amount_positive';
    ELSE
        RAISE NOTICE 'Check constraint check_booking_amount_positive already exists, skipping';
    END IF;

    -- ========================================================================
    -- 2. Ensure base price is positive (additional check for bookings)
    -- ========================================================================
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_booking_base_price_positive'
    ) THEN
        ALTER TABLE bookings 
        ADD CONSTRAINT check_booking_base_price_positive
        CHECK (base_price > 0);
        
        RAISE NOTICE 'Added check constraint: check_booking_base_price_positive';
    ELSE
        RAISE NOTICE 'Check constraint check_booking_base_price_positive already exists, skipping';
    END IF;

    -- ========================================================================
    -- 3. Ensure payment amounts are positive
    -- ========================================================================
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_payment_amount_positive'
    ) THEN
        ALTER TABLE payments 
        ADD CONSTRAINT check_payment_amount_positive
        CHECK (amount > 0);
        
        RAISE NOTICE 'Added check constraint: check_payment_amount_positive';
    ELSE
        RAISE NOTICE 'Check constraint check_payment_amount_positive already exists, skipping';
    END IF;

    -- ========================================================================
    -- 4. Ensure wallet balance is non-negative
    -- ========================================================================
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_wallet_balance_non_negative'
    ) THEN
        ALTER TABLE customer_wallets 
        ADD CONSTRAINT check_wallet_balance_non_negative
        CHECK (balance >= 0);
        
        RAISE NOTICE 'Added check constraint: check_wallet_balance_non_negative';
    ELSE
        RAISE NOTICE 'Check constraint check_wallet_balance_non_negative already exists, skipping';
    END IF;

    -- ========================================================================
    -- 5. Ensure discount amount doesn't exceed total (bookings)
    -- ========================================================================
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_booking_discount_valid'
    ) THEN
        ALTER TABLE bookings 
        ADD CONSTRAINT check_booking_discount_valid
        CHECK (discount_amount >= 0 AND discount_amount <= base_price);
        
        RAISE NOTICE 'Added check constraint: check_booking_discount_valid';
    ELSE
        RAISE NOTICE 'Check constraint check_booking_discount_valid already exists, skipping';
    END IF;

    -- ========================================================================
    -- 6. Ensure tax amount is non-negative (bookings)
    -- ========================================================================
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_booking_tax_non_negative'
    ) THEN
        ALTER TABLE bookings 
        ADD CONSTRAINT check_booking_tax_non_negative
        CHECK (tax_amount >= 0);
        
        RAISE NOTICE 'Added check constraint: check_booking_tax_non_negative';
    ELSE
        RAISE NOTICE 'Check constraint check_booking_tax_non_negative already exists, skipping';
    END IF;

    RAISE NOTICE 'Migration 033_add_check_constraints completed successfully';
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (run separately to verify)
-- ============================================================================
-- 
-- Verify constraints were created:
-- SELECT 
--     tc.constraint_name, 
--     tc.table_name, 
--     cc.check_clause
-- FROM information_schema.table_constraints AS tc 
-- JOIN information_schema.check_constraints AS cc
--   ON tc.constraint_name = cc.constraint_name
-- WHERE tc.constraint_type = 'CHECK' 
--   AND tc.table_name IN ('bookings', 'payments', 'customer_wallets')
--   AND tc.constraint_name IN (
--       'check_booking_amount_positive',
--       'check_booking_base_price_positive',
--       'check_payment_amount_positive',
--       'check_wallet_balance_non_negative',
--       'check_booking_discount_valid',
--       'check_booking_tax_non_negative'
--   )
-- ORDER BY tc.table_name, tc.constraint_name;
-- ============================================================================
-- PRE-MIGRATION DATA VALIDATION
-- ============================================================================
--
-- Before running migration, check for existing invalid data:
--
-- -- 1. Bookings with non-positive amounts
-- SELECT COUNT(*) as invalid_bookings
-- FROM bookings
-- WHERE total_amount <= 0 OR base_price <= 0;
--
-- -- 2. Payments with non-positive amounts
-- SELECT COUNT(*) as invalid_payments
-- FROM payments
-- WHERE amount <= 0;
--
-- -- 3. Wallets with negative balances
-- SELECT COUNT(*) as negative_balances
-- FROM customer_wallets
-- WHERE balance < 0;
--
-- -- 4. Bookings with invalid discounts
-- SELECT COUNT(*) as invalid_discounts
-- FROM bookings
-- WHERE discount_amount < 0 OR discount_amount > base_price;
--
-- If any of these return > 0, you need to fix the data first!
-- ============================================================================

