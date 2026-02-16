-- ============================================================================
-- MIGRATION 556: Fix Vendor Referrals Unique Constraint
-- ============================================================================
-- Date: 2026-02-16
-- Purpose: Remove global UNIQUE constraint on referral_code and make it unique per vendor
--          This allows the same referral code to be used for multiple phone numbers
-- ============================================================================

-- Drop the existing unique constraint on referral_code (globally unique)
-- This allows the same referral code to be used for multiple phone numbers
ALTER TABLE vendor_referrals DROP CONSTRAINT IF EXISTS vendor_referrals_referral_code_key;

-- Drop existing constraints if they exist (in case migration was partially run)
ALTER TABLE vendor_referrals DROP CONSTRAINT IF EXISTS vendor_referrals_referrer_code_unique;
ALTER TABLE vendor_referrals DROP CONSTRAINT IF EXISTS vendor_referrals_referrer_phone_unique;

-- Add a unique constraint on (referrer_vendor_id, referred_phone) to prevent duplicate sends
-- This ensures we don't send the same code to the same phone number multiple times
ALTER TABLE vendor_referrals 
ADD CONSTRAINT vendor_referrals_referrer_phone_unique 
UNIQUE (referrer_vendor_id, referred_phone);

-- Note: referral_code is no longer globally unique
-- Multiple records can have the same referral_code (one per phone number)
-- But each vendor should have one referral code (enforced by application logic)

COMMENT ON CONSTRAINT vendor_referrals_referrer_phone_unique ON vendor_referrals IS 
'Prevents sending the same referral code to the same phone number multiple times';
