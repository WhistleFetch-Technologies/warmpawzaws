-- ============================================================================
-- 705: Peer referral reward on referred customer's first booking (not OTP)
-- ============================================================================
-- Disables HTTP action_sources for customer_referral on OTP verify (703).
-- Emits action_name = customer_referral_first_booking on successful POST
-- /bookings/create and /customer/bookings/create when data.isNew is true.
-- loyalty-events-consumer → processCustomerReferralFirstBookingReward.
-- ============================================================================

-- 1) Stop emitting customer_referral on OTP verify
UPDATE action_sources
SET enabled = false,
    notes = COALESCE(notes, '') || ' [705] Disabled: referrer reward moved to first booking (customer_referral_first_booking).',
    updated_at = NOW()
WHERE method = 'POST'
  AND action_name = 'customer_referral'
  AND route_pattern = '/auth/otp/verify' || chr(10) || '/auth/verify-otp';

-- 2) First booking → referrer award (entity = customer who booked, reference = booking)
INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http',
  '/bookings/create' || chr(10) || '/customer/bookings/create',
  'POST', 200, 299,
  '$.success && $.data.isNew == true',
  'customer_referral_first_booking', 'customer', '$.data.customerId', NULL, 'booking', '$.data.bookingId',
  '{}'::jsonb, true, 115, false,
  '705: Referrer reward when referred user creates first booking (BaseHandler data.customerId / data.bookingId)'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a
  WHERE a.method = 'POST'
    AND a.action_name = 'customer_referral_first_booking'
    AND a.route_pattern = '/bookings/create' || chr(10) || '/customer/bookings/create'
);

UPDATE action_sources SET
  success_predicate = '$.success && $.data.isNew == true',
  entity_resolver = '$.data.customerId',
  entity_type = 'customer',
  amount_resolver = NULL,
  reference_type = 'booking',
  reference_id_resolver = '$.data.bookingId',
  metadata_resolvers = '{}'::jsonb,
  enabled = true,
  priority = 115,
  dry_run = false,
  notes = COALESCE(notes, '') || ' [705] Sync entity/reference resolvers.',
  updated_at = NOW()
WHERE method = 'POST'
  AND action_name = 'customer_referral_first_booking'
  AND route_pattern = '/bookings/create' || chr(10) || '/customer/bookings/create';
