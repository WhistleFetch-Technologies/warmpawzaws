-- ============================================================================
-- REFERRALS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS referrals (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL,
    referred_id UUID,
    referral_code TEXT NOT NULL,
    status TEXT DEFAULT 'pending'::text,
    reward_points INT4 DEFAULT 0,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE referrals ADD CONSTRAINT referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES customers(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE referrals ADD CONSTRAINT referrals_referred_id_fkey FOREIGN KEY (referred_id) REFERENCES customers(id) ON UPDATE NO ACTION ON DELETE SET NULL;

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE referrals ADD CONSTRAINT referrals_referral_code_key UNIQUE (referral_code);

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE referrals ADD CONSTRAINT referrals_status_check CHECK (status IN ('pending', 'completed', 'expired'));

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX referrals_pkey ON public.referrals USING btree (id);
CREATE UNIQUE INDEX referrals_referral_code_key ON public.referrals USING btree (referral_code);
CREATE INDEX idx_referrals_referrer ON public.referrals USING btree (referrer_id);
CREATE INDEX idx_referrals_referred ON public.referrals USING btree (referred_id) WHERE referred_id IS NOT NULL;
CREATE INDEX idx_referrals_status ON public.referrals USING btree (status);
CREATE INDEX idx_referrals_expires ON public.referrals USING btree (expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE referrals IS 'Customer referral system - tracks referrals and rewards';
COMMENT ON COLUMN referrals.referrer_id IS 'Customer who made the referral';
COMMENT ON COLUMN referrals.referred_id IS 'Customer who was referred (set when referral is completed)';
COMMENT ON COLUMN referrals.referral_code IS 'Unique referral code for the referrer';
COMMENT ON COLUMN referrals.status IS 'Referral status: pending, completed, expired';
COMMENT ON COLUMN referrals.reward_points IS 'Reward points awarded to referrer when referral is completed';
COMMENT ON COLUMN referrals.completed_at IS 'Timestamp when referral was completed (referred customer signed up/placed order)';
COMMENT ON COLUMN referrals.expires_at IS 'Expiration date for the referral code';
