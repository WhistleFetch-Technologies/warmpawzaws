-- 710: POST /razorpay/verify-payment → book_grooming
-- Verify handler returns flat JSON: success, bookingId, customerId, totalAmount, loyaltyBookingKind ('grooming' | ...).
-- Mirrors book_vet_consultation on the same route (638); disjoint predicates (grooming vs vet_consultation).

INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http', '/razorpay/verify-payment', 'POST', 200, 299,
  '$.success && $.bookingId && $.loyaltyBookingKind == ''grooming''',
  'book_grooming', 'customer', '$.customerId', '$.totalAmount', 'booking', '$.bookingId',
  '{}'::jsonb, true, 125, false,
  'Grooming booking paid via Razorpay verify — flat verify response [710]'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a
  WHERE a.method = 'POST' AND a.route_pattern = '/razorpay/verify-payment' AND a.action_name = 'book_grooming'
);

UPDATE action_sources SET
  success_predicate = '$.success && $.bookingId && $.loyaltyBookingKind == ''grooming''',
  entity_resolver = '$.customerId',
  entity_type = 'customer',
  amount_resolver = '$.totalAmount',
  reference_type = 'booking',
  reference_id_resolver = '$.bookingId',
  metadata_resolvers = '{}'::jsonb,
  enabled = true,
  priority = 125,
  dry_run = false,
  notes = 'Grooming booking paid via Razorpay verify [710]',
  updated_at = NOW()
WHERE method = 'POST' AND route_pattern = '/razorpay/verify-payment' AND action_name = 'book_grooming';
