-- 637: Single action_sources row for buy_medicine (one logical action, two HTTP paths).
--
-- loyalty_action_rules: action_name is UNIQUE — there is only ever one buy_medicine rule row.
-- action_sources: previously two rows (same action_name, different route_pattern) because
--   middleware matched one route_pattern per row. That looked like a duplicate "action".
--
-- This migration merges into one row: route_pattern holds two lines (see action-source-middleware).
-- Predicates and reference resolvers use || fallbacks so both response shapes work:
--   - Razorpay verify: pharmacyOrderId, customerId, totalAmount
--   - POST .../payment: order.id, param.orderId, customerId, totalAmount

UPDATE action_sources SET
  route_pattern = '/razorpay/verify-payment' || CHR(10) || '/pharmacy/orders/:orderId/payment',
  success_predicate = '$.success && ($.pharmacyOrderId || $.order.id)',
  reference_id_resolver = '$.pharmacyOrderId || $.param.orderId || $.order.id',
  notes = 'Pharmacy purchase — Razorpay verify or POST pharmacy order payment [637]',
  updated_at = NOW()
WHERE method = 'POST'
  AND action_name = 'buy_medicine'
  AND route_pattern = '/razorpay/verify-payment';

DELETE FROM action_sources
WHERE method = 'POST'
  AND action_name = 'buy_medicine'
  AND route_pattern = '/pharmacy/orders/:orderId/payment';
