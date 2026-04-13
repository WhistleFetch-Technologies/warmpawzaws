-- Optional seed: customer_referral (referred user bonus on OTP verify via action_sources).
-- Prod may already have this row; ON CONFLICT skips. Adjust points_value in RDS if needed.
-- loyalty_points_service matches user_type IN ('customer','both') when awarding to a customer.

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
  is_active
) VALUES (
  'customer_referral',
  'referral_rewards',
  'both',
  'fixed',
  100,
  NULL,
  'one_time',
  'Sign up / verify OTP with a referral link',
  'Emitted as ActionOccurred action_name customer_referral; consumer checks referrals + customer_referrals before award',
  true
)
ON CONFLICT (action_name) DO NOTHING;
