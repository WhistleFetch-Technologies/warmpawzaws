-- ============================================================================
-- MIGRATION 556: Create Customer Referrals Table
-- ============================================================================
-- Date: 2026-02-17
-- Purpose: Create table for customer-to-customer referral system
-- ============================================================================

-- Customer Referrals Table
-- Tracks customer-to-customer referrals for loyalty points
CREATE TABLE IF NOT EXISTS customer_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    referred_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    referred_phone TEXT NOT NULL, -- Phone number that received the referral code
    referral_code TEXT NOT NULL, -- Referral code (NOT unique - same code can be used by multiple phones)
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'approved', 'expired')),
    applied_at TIMESTAMPTZ, -- When the referral code was used during registration
    approved_at TIMESTAMPTZ, -- When the referred customer completed first booking
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint: A referrer can only refer a specific phone once
    UNIQUE(referrer_customer_id, referred_phone)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_referrals_referrer ON customer_referrals(referrer_customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_referrals_referred ON customer_referrals(referred_customer_id) WHERE referred_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_referrals_code ON customer_referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_customer_referrals_phone ON customer_referrals(referred_phone);
CREATE INDEX IF NOT EXISTS idx_customer_referrals_status ON customer_referrals(status) WHERE status IN ('pending', 'applied', 'approved');

-- Comments
COMMENT ON TABLE customer_referrals IS 'Customer-to-customer referral tracking for loyalty points';
COMMENT ON COLUMN customer_referrals.referrer_customer_id IS 'Customer who sent the referral code';
COMMENT ON COLUMN customer_referrals.referred_customer_id IS 'Customer who used the referral code (set when customer completes first booking)';
COMMENT ON COLUMN customer_referrals.referred_phone IS 'Phone number that received the referral code via SMS';
COMMENT ON COLUMN customer_referrals.referral_code IS 'Unique referral code (format: CREF{customerId_last4}{random})';
COMMENT ON COLUMN customer_referrals.status IS 'Referral status: pending (code sent), applied (code used), approved (first booking completed), expired';
COMMENT ON COLUMN customer_referrals.applied_at IS 'Timestamp when referral code was used during customer registration';
COMMENT ON COLUMN customer_referrals.approved_at IS 'Timestamp when referred customer completed first booking (triggers points award)';
