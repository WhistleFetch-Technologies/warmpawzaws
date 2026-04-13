-- Loyalty: POST /razorpay/verify-payment → buy_medicine (pharmacy Razorpay) and book_vet_consultation (tele vet, prepaid).
-- Verify handler returns success, customerId, totalAmount, pharmacyOrderId / bookingId, loyaltyBookVetConsultationForPayment.
-- Avoid double vet points: POST /bookings/create only when awardBookVetLoyaltyOnCreate (paid/completed/zero at create).
-- Idempotent without ON CONFLICT (RDS may lack uq_action_sources_method_route_action).

-- buy_medicine via Razorpay verify (pharmacy_order_id on payments row)
INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http', '/razorpay/verify-payment', 'POST', 200, 299,
  '$.success && $.pharmacyOrderId',
  'buy_medicine', 'customer', '$.customerId', '$.totalAmount', 'pharmacy_order', '$.pharmacyOrderId',
  '{}'::jsonb, true, 125, false,
  'Pharmacy order paid via Razorpay verify — disjoint from /pharmacy/orders/:id/payment (COD etc.)'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a
  WHERE a.method = 'POST' AND a.route_pattern = '/razorpay/verify-payment' AND a.action_name = 'buy_medicine'
);
UPDATE action_sources SET
  success_predicate = '$.success && $.pharmacyOrderId',
  entity_resolver = '$.customerId',
  entity_type = 'customer',
  amount_resolver = '$.totalAmount',
  reference_type = 'pharmacy_order',
  reference_id_resolver = '$.pharmacyOrderId',
  metadata_resolvers = '{}'::jsonb,
  enabled = true,
  priority = 125,
  dry_run = false,
  notes = 'Pharmacy order paid via Razorpay verify — disjoint from /pharmacy/orders/:id/payment (COD etc.)',
  updated_at = NOW()
WHERE method = 'POST' AND route_pattern = '/razorpay/verify-payment' AND action_name = 'buy_medicine';

-- book_vet_consultation: tele vet only, prepaid (pending at create → no create-side award)
INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http', '/razorpay/verify-payment', 'POST', 200, 299,
  '$.success && $.bookingId && $.loyaltyBookVetConsultationForPayment',
  'book_vet_consultation', 'customer', '$.customerId', '$.totalAmount', 'booking', '$.bookingId',
  '{}'::jsonb, true, 125, false,
  'Tele vet consult paid online — loyaltyBookVetConsultationForPayment set in verify handler'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a
  WHERE a.method = 'POST' AND a.route_pattern = '/razorpay/verify-payment' AND a.action_name = 'book_vet_consultation'
);
UPDATE action_sources SET
  success_predicate = '$.success && $.bookingId && $.loyaltyBookVetConsultationForPayment',
  entity_resolver = '$.customerId',
  entity_type = 'customer',
  amount_resolver = '$.totalAmount',
  reference_type = 'booking',
  reference_id_resolver = '$.bookingId',
  metadata_resolvers = '{}'::jsonb,
  enabled = true,
  priority = 125,
  dry_run = false,
  notes = 'Tele vet consult paid online — loyaltyBookVetConsultationForPayment set in verify handler',
  updated_at = NOW()
WHERE method = 'POST' AND route_pattern = '/razorpay/verify-payment' AND action_name = 'book_vet_consultation';

-- Vet at create: only when already paid/completed or free (not pending prepaid tele)
UPDATE action_sources SET
  success_predicate = '$.success && $.data.isNew == true && $.data.awardBookVetLoyaltyOnCreate',
  notes = COALESCE(notes, '') || ' [634] awardBookVetLoyaltyOnCreate avoids double with Razorpay verify for pending prepaid.',
  updated_at = NOW()
WHERE method = 'POST' AND route_pattern = '/bookings/create' AND action_name = 'book_vet_consultation';

UPDATE action_sources SET
  success_predicate = '$.success && $.data.isNew == true && $.data.awardBookVetLoyaltyOnCreate',
  notes = COALESCE(notes, '') || ' [634] awardBookVetLoyaltyOnCreate avoids double with Razorpay verify for pending prepaid.',
  updated_at = NOW()
WHERE method = 'POST' AND route_pattern = '/customer/bookings/create' AND action_name = 'book_vet_consultation';
