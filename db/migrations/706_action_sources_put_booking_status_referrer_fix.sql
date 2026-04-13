-- ============================================================================
-- 706: Fix PUT /bookings/:bookingId/status → action_name customer_referral
-- ============================================================================
-- action_name stays customer_referral (same loyalty rule key as OTP path).
-- Consumer branches: reference.type === 'booking' → first-booking reward; else OTP.
--
-- Predicate matches BaseHandler payload: { success, data: { bookingId, customerId, newStatus, isNew, ... } }.
-- entity_resolver = customer UUID; reference_id_resolver = booking id for ActionOccurred.reference.
--
-- Optional: disable POST create → customer_referral_first_booking (705) if you rely on PUT only.
-- ============================================================================

UPDATE action_sources
SET
  action_name = 'customer_referral',
  success_predicate = '$.success && $.data.newStatus == ''completed'' && $.data.isNew == true',
  entity_resolver = '$.data.customerId',
  entity_type = 'customer',
  reference_type = 'booking',
  reference_id_resolver = '$.data.bookingId',
  enabled = true,
  priority = 275,
  dry_run = false,
  notes = COALESCE(notes, '') || ' [706] customer_referral + booking ref → first-booking handler; entity customerId.',
  updated_at = NOW()
WHERE method = 'PUT'
  AND route_pattern = '/bookings/:bookingId/status'
  AND action_name IN ('customer_referral', 'customer_referral_first_booking');

-- Optional: stop create-time referral (avoid double trigger with PUT completed)
UPDATE action_sources
SET enabled = false,
    notes = COALESCE(notes, '') || ' [706] Disabled: PUT customer_referral on completed handles reward.',
    updated_at = NOW()
WHERE method = 'POST'
  AND action_name = 'customer_referral_first_booking'
  AND (
    route_pattern LIKE '%/bookings/create%'
    OR route_pattern LIKE '%/customer/bookings/create%'
  );
