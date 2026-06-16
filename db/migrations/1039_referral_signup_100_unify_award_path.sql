-- ============================================================================
-- 1039: referral_signup = 100 pts; single referee award path on first booking
-- ============================================================================
-- Supersedes 1036's 50-point default and duplicate action_sources row.
-- Referee credit: customer_referral on POST /razorpay/verify-payment only
--   → processCustomerReferralFirstBookingReward (referral_signup action for referee).
-- ============================================================================

UPDATE loyalty_action_rules
SET points_value = 100,
    description = COALESCE(NULLIF(TRIM(description), ''), 'Sign up with referral code and complete first booking'),
    updated_at = NOW()
WHERE action_name = 'referral_signup'
  AND (points_value IS NULL OR points_value <> 100);

INSERT INTO loyalty_action_rules (
  action_name,
  action_category,
  user_type,
  points_type,
  points_value,
  base_amount,
  frequency_type,
  description,
  notes,
  is_active,
  priority
)
SELECT
  'referral_signup',
  'referral_rewards',
  'customer',
  'fixed',
  100,
  NULL,
  'one_time',
  'Sign up with a friend''s referral code and complete first booking',
  '1039: Referee welcome bonus (100 pts) on first paid booking',
  true,
  50
WHERE NOT EXISTS (
  SELECT 1 FROM loyalty_action_rules WHERE action_name = 'referral_signup'
);

-- Disable legacy referral_signup emitter on booking payment (1036); avoids double referee credit.
UPDATE action_sources SET
  enabled = false,
  dry_run = true,
  notes = COALESCE(notes, '') || ' [1039] Disabled: referee award unified in customer_referral first-booking handler.',
  updated_at = NOW()
WHERE method = 'POST'
  AND route_pattern = '/razorpay/verify-payment'
  AND action_name = 'referral_signup';
