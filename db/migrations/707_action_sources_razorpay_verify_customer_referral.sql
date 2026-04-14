-- ============================================================================
-- 707: Peer referral reward on POST /razorpay/verify-payment (booking paid)
-- ============================================================================
-- Handler (razorpay.razorpay.ts VerifyPaymentHandler) returns BaseHandler.success(result)
-- with a FLAT body — see migration 634. Keys include:
--   success, message, paymentId, orderId, bookingId, customerId, totalAmount,
--   pharmacyOrderId (pharmacy only), loyaltyBookVetConsultationForPayment (tele vet flag).
-- Resolvers MUST use $.field not $.data.field.
--
-- Predicate $.success && $.bookingId: real booking payments only (excludes pharmacy,
-- diagnostics-without-payment-row, prepaid-without-booking-yet).
--
-- loyalty-events-consumer: action customer_referral + reference.type booking →
-- processCustomerReferralFirstBookingReward.
-- ============================================================================

INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http',
  '/razorpay/verify-payment',
  'POST',
  200,
  299,
  '$.success && $.bookingId',
  'customer_referral',
  'customer',
  '$.customerId',
  NULL,
  'booking',
  '$.bookingId',
  '{}'::jsonb,
  true,
  120,
  false,
  '707: Referrer reward when referred customer pays for a booking (Razorpay verify); flat response body'
WHERE NOT EXISTS (
  SELECT 1
  FROM action_sources a
  WHERE a.method = 'POST'
    AND a.route_pattern = '/razorpay/verify-payment'
    AND a.action_name = 'customer_referral'
);

UPDATE action_sources
SET
  success_predicate = '$.success && $.bookingId',
  entity_resolver = '$.customerId',
  entity_type = 'customer',
  reference_type = 'booking',
  reference_id_resolver = '$.bookingId',
  amount_resolver = NULL,
  metadata_resolvers = '{}'::jsonb,
  enabled = true,
  priority = 120,
  dry_run = false,
  notes = '707: customer_referral on booking payment verified (flat $.customerId / $.bookingId)',
  updated_at = NOW()
WHERE method = 'POST'
  AND route_pattern = '/razorpay/verify-payment'
  AND action_name = 'customer_referral';

-- Stop peer-referral on booking status PUT (use Razorpay verify instead)
UPDATE action_sources
SET
  enabled = false,
  notes = COALESCE(notes, '') || ' [707] Disabled: customer_referral moved to POST /razorpay/verify-payment.',
  updated_at = NOW()
WHERE method = 'PUT'
  AND route_pattern = '/bookings/:bookingId/status'
  AND action_name = 'customer_referral';
