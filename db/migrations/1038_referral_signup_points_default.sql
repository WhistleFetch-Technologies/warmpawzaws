-- Ensure referral_signup action rule is 100 points (replaces 1036's 50-point default).
-- See 1039_referral_signup_100_unify_award_path.sql for single award path on booking payment.

UPDATE loyalty_action_rules
SET points_value = 100,
    updated_at = COALESCE(updated_at, NOW())
WHERE action_name = 'referral_signup'
  AND (points_value IS NULL OR points_value <> 100);
