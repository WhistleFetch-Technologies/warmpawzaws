-- Ensure referral_signup action rule defaults to 100 points (idempotent)

UPDATE loyalty_action_rules
SET points_value = 100,
    updated_at = COALESCE(updated_at, NOW())
WHERE action_name = 'referral_signup'
  AND (points_value IS NULL OR points_value <> 100);
