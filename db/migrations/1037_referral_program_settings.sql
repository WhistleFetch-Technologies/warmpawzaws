-- Referral program settings, redemption counters, and status lifecycle columns

CREATE TABLE IF NOT EXISTS referral_program_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  max_redemptions_per_code INT,
  minimum_booking_amount NUMERIC(12, 2),
  referrer_action_name TEXT NOT NULL DEFAULT 'customer_referral',
  referee_action_name TEXT NOT NULL DEFAULT 'referral_signup',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO referral_program_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE referrals
  ADD COLUMN IF NOT EXISTS redemption_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_redemptions INT;

ALTER TABLE referral_redemptions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rewarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

COMMENT ON TABLE referral_program_settings IS 'Singleton referral program configuration (enable switch, caps, action names)';
COMMENT ON COLUMN referrals.redemption_count IS 'Atomic counter for max-redemption enforcement';
COMMENT ON COLUMN referral_redemptions.status IS 'pending | qualified | rewarded | rejected';
