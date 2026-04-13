-- 636: Remove segment-based gating from loyalty rule buy_medicine.
--
-- Why "buy_medicine" can appear twice in admin or DB browsing:
-- - Table loyalty_action_rules has at most ONE row per action_name (UNIQUE on action_name).
-- - Table action_sources can have MANY rows that emit the SAME action_name from different HTTP routes.
--   For buy_medicine, prod typically has:
--     POST /pharmacy/orders/:orderId/payment
--     POST /razorpay/verify-payment
--   Both intentionally map to action buy_medicine (COD or offline payment vs Razorpay verify).
-- Segments remain for grouping customers or vendors elsewhere — not required on this rule.

UPDATE loyalty_action_rules
SET
  conditions = COALESCE(conditions, '{}'::jsonb) - 'segment_ids',
  updated_at = NOW()
WHERE action_name = 'buy_medicine'
  AND (conditions ? 'segment_ids');
