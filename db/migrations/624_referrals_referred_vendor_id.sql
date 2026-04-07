-- ============================================================================
-- 624: Customer → vendor referral (vendor signup uses customer's WARM code)
-- ============================================================================
-- Links referred vendor on `referrals` row (referrer_id = customer).
-- Mutually exclusive with peer customer referral: one code row uses either
-- referred_id OR referred_vendor_id.
-- ============================================================================

ALTER TABLE referrals
  ADD COLUMN IF NOT EXISTS referred_vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;

COMMENT ON COLUMN referrals.referred_vendor_id IS 'Vendor who joined using this customer WARM referral code';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'referrals_one_referred_party_chk'
  ) THEN
    ALTER TABLE referrals
      ADD CONSTRAINT referrals_one_referred_party_chk CHECK (
        NOT (referred_id IS NOT NULL AND referred_vendor_id IS NOT NULL)
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_referred_vendor_id_unique
  ON referrals (referred_vendor_id)
  WHERE referred_vendor_id IS NOT NULL;
