-- ============================================================================
-- MIGRATION 555: Create Vendor Referrals Table
-- ============================================================================
-- Date: 2026-02-16
-- Purpose: Create table for vendor-to-vendor referral system
-- ============================================================================

-- Vendor Referrals Table
-- Tracks vendor-to-vendor referrals for loyalty points
CREATE TABLE IF NOT EXISTS vendor_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    referred_vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    referred_phone TEXT NOT NULL, -- Phone number that received the referral code
    referral_code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'approved', 'expired')),
    applied_at TIMESTAMPTZ, -- When the referral code was used during registration
    approved_at TIMESTAMPTZ, -- When the referred vendor was approved by admin
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_vendor_referrals_referrer ON vendor_referrals(referrer_vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_referrals_referred ON vendor_referrals(referred_vendor_id) WHERE referred_vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendor_referrals_code ON vendor_referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_vendor_referrals_phone ON vendor_referrals(referred_phone);
CREATE INDEX IF NOT EXISTS idx_vendor_referrals_status ON vendor_referrals(status) WHERE status IN ('pending', 'applied', 'approved');

-- Comments
COMMENT ON TABLE vendor_referrals IS 'Vendor-to-vendor referral tracking for loyalty points';
COMMENT ON COLUMN vendor_referrals.referrer_vendor_id IS 'Vendor who sent the referral code';
COMMENT ON COLUMN vendor_referrals.referred_vendor_id IS 'Vendor who used the referral code (set when vendor is approved)';
COMMENT ON COLUMN vendor_referrals.referred_phone IS 'Phone number that received the referral code via SMS';
COMMENT ON COLUMN vendor_referrals.referral_code IS 'Unique referral code (format: VREF{vendorId_last4}{random})';
COMMENT ON COLUMN vendor_referrals.status IS 'Referral status: pending (code sent), applied (code used), approved (vendor approved), expired';
COMMENT ON COLUMN vendor_referrals.applied_at IS 'Timestamp when referral code was used during vendor registration';
COMMENT ON COLUMN vendor_referrals.approved_at IS 'Timestamp when referred vendor was approved by admin (triggers points award)';
