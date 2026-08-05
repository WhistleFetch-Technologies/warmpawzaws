-- ============================================================================
-- Migration 1092: WAPPT platform default — 1h full refund, under 1h no refund
-- ============================================================================
-- Customer cancels Book Appointment booking:
--   >= 1 hour before slot → 100% refund
--   < 1 hour before slot → 0% refund
-- Provider cancel tier unchanged.

DELETE FROM vendor_refund_tiers
WHERE commerce_mode = 'warmpawz_appointments'
  AND policy_scope = 'platform'
  AND cancelled_by = 'pet_parent';

INSERT INTO vendor_refund_tiers (
  name, description, vendor_types, service_location, hours_before_service,
  refund_percentage, cancellation_fee, is_active, tier_level, cancelled_by,
  commerce_mode, policy_scope, hours_operator, hours_threshold, cancellation_window
)
SELECT
  'WAPPT Customer 1h+ full refund',
  'Book Appointment — cancel at least 1 hour before slot for full refund',
  ARRAY[]::TEXT[], 'all', 1, 100, 0, true, 10, 'pet_parent',
  'warmpawz_appointments', 'platform', 'gte', 1, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM vendor_refund_tiers
  WHERE commerce_mode = 'warmpawz_appointments'
    AND policy_scope = 'platform'
    AND cancelled_by = 'pet_parent'
    AND name = 'WAPPT Customer 1h+ full refund'
);

INSERT INTO vendor_refund_tiers (
  name, description, vendor_types, service_location, hours_before_service,
  refund_percentage, cancellation_fee, is_active, tier_level, cancelled_by,
  commerce_mode, policy_scope, hours_operator, hours_threshold, cancellation_window
)
SELECT
  'WAPPT Customer under 1h no refund',
  'Book Appointment — cancel less than 1 hour before slot: no refund',
  ARRAY[]::TEXT[], 'all', 0, 0, 0, true, 20, 'pet_parent',
  'warmpawz_appointments', 'platform', 'lt', 1, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM vendor_refund_tiers
  WHERE commerce_mode = 'warmpawz_appointments'
    AND policy_scope = 'platform'
    AND cancelled_by = 'pet_parent'
    AND name = 'WAPPT Customer under 1h no refund'
);
