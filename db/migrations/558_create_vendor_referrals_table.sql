-- ============================================================================
-- VENDOR REFERRAL SYSTEM
-- ============================================================================
-- Migration: 558
-- Description: Create vendor_referrals table for vendor-to-vendor referral system
-- Date: 2026-01-XX
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    referred_vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    referred_phone TEXT NOT NULL, -- Phone number that received the referral code
    referral_code TEXT NOT NULL, -- Referral code (NOT unique - same code can be used by multiple phones)
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'approved', 'expired')),
    applied_at TIMESTAMPTZ, -- When the referral code was used during registration
    approved_at TIMESTAMPTZ, -- When the referred vendor completed first booking/service
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint: A referrer can only refer a specific phone once
    UNIQUE(referrer_vendor_id, referred_phone)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_vendor_referrals_referrer_vendor_id ON vendor_referrals(referrer_vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_referrals_referred_vendor_id ON vendor_referrals(referred_vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_referrals_referral_code ON vendor_referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_vendor_referrals_referred_phone ON vendor_referrals(referred_phone);
CREATE INDEX IF NOT EXISTS idx_vendor_referrals_status ON vendor_referrals(status);

-- Comments
COMMENT ON TABLE vendor_referrals IS 'Tracks vendor-to-vendor referrals. Points are awarded when referred vendor creates account using referral code.';
COMMENT ON COLUMN vendor_referrals.referrer_vendor_id IS 'Vendor who sent the referral code';
COMMENT ON COLUMN vendor_referrals.referred_vendor_id IS 'Vendor who used the referral code (set when account is created)';
COMMENT ON COLUMN vendor_referrals.referred_phone IS 'Phone number that received/used the referral code';
COMMENT ON COLUMN vendor_referrals.referral_code IS 'Referral code (can be reused by different phones)';
COMMENT ON COLUMN vendor_referrals.status IS 'pending: code sent but not used, applied: code used during registration, approved: points awarded, expired: code expired';
