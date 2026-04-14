-- ============================================================================
-- 704: One referral code, many peer referees (customer → customer)
-- ============================================================================
-- Peers are stored in referral_redemptions; referrals.referred_id is cleared
-- after backfill so the master row no longer blocks additional friends or
-- customer→vendor (referred_vendor_id) on the same code row.
-- UNIQUE(referred_id) enforces at most one referral reward per referee.
-- ============================================================================

CREATE TABLE IF NOT EXISTS referral_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS referral_redemptions_referred_id_uidx
  ON referral_redemptions (referred_id);

CREATE UNIQUE INDEX IF NOT EXISTS referral_redemptions_referral_referred_uidx
  ON referral_redemptions (referral_id, referred_id);

CREATE INDEX IF NOT EXISTS referral_redemptions_referral_id_idx
  ON referral_redemptions (referral_id);

COMMENT ON TABLE referral_redemptions IS 'Peer uses of a customer referral code (one row per friend; referred_id unique globally)';

-- Backfill from legacy single-friend column
INSERT INTO referral_redemptions (referral_id, referred_id, created_at)
SELECT r.id, r.referred_id, COALESCE(r.completed_at, r.created_at, NOW())
FROM referrals r
WHERE r.referred_id IS NOT NULL
ON CONFLICT (referred_id) DO NOTHING;

-- Canonical peer links live in referral_redemptions; clear master referred_id
UPDATE referrals r
SET referred_id = NULL
WHERE referred_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM referral_redemptions rr WHERE rr.referral_id = r.id AND rr.referred_id = r.referred_id);
