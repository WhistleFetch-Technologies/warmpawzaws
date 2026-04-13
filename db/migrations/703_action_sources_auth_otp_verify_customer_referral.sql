-- ============================================================================
-- MIGRATION 703: action_sources for POST /auth/otp/verify + /auth/verify-otp → customer_referral
-- ============================================================================
-- Date: 2026-04-09
-- Pairs with:
--   - loyalty_action_rules.customer_referral (702_loyalty_action_rule_customer_referral.sql)
--   - loyalty-events-consumer.ts → processCustomerReferralOtpVerifyReward
--   - applyCustomerReferralOnAuth in auth-enhanced (sets referrals.referred_id when code present)
--
-- Response shape: VerifyOtpHandlerEnhanced → BaseHandlerEnhanced.success double-wraps:
--   $.data.data.user.id, $.data.data.user.role, $.data.data.profile.id
-- Idempotent: WHERE NOT EXISTS + UPDATE (same pattern as 634).
-- ============================================================================

INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http',
  '/auth/otp/verify' || chr(10) || '/auth/verify-otp',
  'POST', 200, 299,
  '$.success && $.data.data.user.role == ''customer''',
  'customer_referral', 'customer', '$.data.data.user.id || $.data.data.profile.id', NULL, NULL, NULL,
  '{}'::jsonb, true, 110, false,
  '703: Customer OTP verify — customer_referral → loyalty-events-consumer (referred user points)'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a
  WHERE a.method = 'POST'
    AND a.action_name = 'customer_referral'
    AND a.route_pattern = '/auth/otp/verify' || chr(10) || '/auth/verify-otp'
);

UPDATE action_sources SET
  success_predicate = '$.success && $.data.data.user.role == ''customer''',
  entity_resolver = '$.data.data.user.id || $.data.data.profile.id',
  entity_type = 'customer',
  metadata_resolvers = '{}'::jsonb,
  enabled = true,
  priority = 110,
  dry_run = false,
  notes = COALESCE(notes, '') || ' [703] entity paths: $.data.data.* (BaseHandlerEnhanced wrapper).',
  updated_at = NOW()
WHERE method = 'POST'
  AND action_name = 'customer_referral'
  AND route_pattern = '/auth/otp/verify' || chr(10) || '/auth/verify-otp';
