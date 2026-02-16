-- ============================================================================
-- MIGRATION 557: Fix Customer Referrals Table Constraints
-- ============================================================================
-- Date: 2026-02-17
-- Purpose: Fix unique constraint on referral_code and add proper constraint
-- ============================================================================

-- Drop the incorrect UNIQUE constraint on referral_code
-- (Multiple customers can use the same referral code)
ALTER TABLE customer_referrals 
DROP CONSTRAINT IF EXISTS customer_referrals_referral_code_key;

-- Add unique constraint on (referrer_customer_id, referred_phone)
-- This ensures a referrer can only refer a specific phone once
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'customer_referrals_referrer_phone_unique'
    ) THEN
        ALTER TABLE customer_referrals 
        ADD CONSTRAINT customer_referrals_referrer_phone_unique 
        UNIQUE (referrer_customer_id, referred_phone);
    END IF;
END $$;

COMMENT ON CONSTRAINT customer_referrals_referrer_phone_unique ON customer_referrals IS 
'Prevents sending the same referral code to the same phone number multiple times';
