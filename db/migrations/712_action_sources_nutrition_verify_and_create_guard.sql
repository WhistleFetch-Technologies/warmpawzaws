-- 712: Nutrition consultation loyalty — Razorpay verify-payment + create-side guard (no double with prepaid verify).
-- Code: booking create response includes awardBookNutritionLoyaltyOnCreate (same idea as awardBookVetLoyaltyOnCreate).

INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http', '/razorpay/verify-payment', 'POST', 200, 299,
  '$.success && $.bookingId && $.loyaltyBookingKind == ''nutrition_consultation''',
  'book_nutrition_consultation', 'customer', '$.customerId', '$.totalAmount', 'booking', '$.bookingId',
  '{}'::jsonb, true, 125, false,
  'Nutrition consult paid via Razorpay verify — loyaltyBookingKind from resolveLoyaltyBookingKind [712]'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a
  WHERE a.method = 'POST' AND a.route_pattern = '/razorpay/verify-payment' AND a.action_name = 'book_nutrition_consultation'
);
UPDATE action_sources SET
  success_predicate = '$.success && $.bookingId && $.loyaltyBookingKind == ''nutrition_consultation''',
  entity_resolver = '$.customerId',
  entity_type = 'customer',
  amount_resolver = '$.totalAmount',
  reference_type = 'booking',
  reference_id_resolver = '$.bookingId',
  metadata_resolvers = '{}'::jsonb,
  enabled = true,
  priority = 125,
  dry_run = false,
  notes = 'Nutrition consult paid via Razorpay verify [712]',
  updated_at = NOW()
WHERE method = 'POST' AND route_pattern = '/razorpay/verify-payment' AND action_name = 'book_nutrition_consultation';

UPDATE action_sources SET
  success_predicate = '$.success && $.data.isNew == true && $.data.loyaltyServiceKind == ''nutrition_consultation'' && $.data.awardBookNutritionLoyaltyOnCreate',
  notes = COALESCE(notes, '') || ' [712] Create only when paid/zero at create, prepaid uses verify-payment.',
  updated_at = NOW()
WHERE method = 'POST' AND route_pattern = '/bookings/create' AND action_name = 'book_nutrition_consultation';

UPDATE action_sources SET
  success_predicate = '$.success && $.data.isNew == true && $.data.loyaltyServiceKind == ''nutrition_consultation'' && $.data.awardBookNutritionLoyaltyOnCreate',
  notes = COALESCE(notes, '') || ' [712] Create only when paid/zero at create, prepaid uses verify-payment.',
  updated_at = NOW()
WHERE method = 'POST' AND route_pattern = '/customer/bookings/create' AND action_name = 'book_nutrition_consultation';
