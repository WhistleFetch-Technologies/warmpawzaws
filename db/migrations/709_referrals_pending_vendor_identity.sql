-- ============================================================================
-- 709: Reserve customer WARM referral on vendor application (before vendors row)
-- ============================================================================
-- `validateAndStoreReferralCodeForVendorApplication` sets this when a vendor
-- applicant submits a valid peer code; cleared when `referred_vendor_id` is set.
-- ============================================================================

ALTER TABLE referrals
  ADD COLUMN IF NOT EXISTS pending_vendor_identity_id UUID
    REFERENCES vendor_identity(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_pending_vendor_identity_uidx
  ON referrals (pending_vendor_identity_id)
  WHERE pending_vendor_identity_id IS NOT NULL;

COMMENT ON COLUMN referrals.pending_vendor_identity_id IS
  'Vendor_identity that reserved this WARM code at application submit; cleared when referred_vendor_id is set';
