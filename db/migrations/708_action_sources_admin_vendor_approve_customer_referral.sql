-- ============================================================================
-- 708: customer_referral on POST /admin/vendor/application/:applicationId/approve
-- ============================================================================
-- When admin approves a vendor who signed up with a customer's WARM code,
-- award the referring customer (after referrals.referred_vendor_id is linked).
-- Response shape: { success, message, vendorId, applicationId } (flat body).
-- Entity = approved vendor; reference = application id for ActionOccurred traceability.
-- ============================================================================

INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http',
  '/admin/vendor/application/:applicationId/approve',
  'POST',
  200,
  299,
  '$.success && $.vendorId',
  'customer_referral',
  'vendor',
  '$.vendorId',
  NULL,
  'vendor_application_approval',
  '$.applicationId',
  '{}'::jsonb,
  true,
  118,
  false,
  '708: Award customer referrer when referred vendor is approved (admin)'
WHERE NOT EXISTS (
  SELECT 1
  FROM action_sources a
  WHERE a.method = 'POST'
    AND a.route_pattern = '/admin/vendor/application/:applicationId/approve'
    AND a.action_name = 'customer_referral'
);

UPDATE action_sources
SET
  success_predicate = '$.success && $.vendorId',
  entity_resolver = '$.vendorId',
  entity_type = 'vendor',
  reference_type = 'vendor_application_approval',
  reference_id_resolver = '$.applicationId',
  amount_resolver = NULL,
  metadata_resolvers = '{}'::jsonb,
  enabled = true,
  priority = 118,
  dry_run = false,
  notes = '708: customer_referral when referred vendor approved (flat $.vendorId / $.applicationId)',
  updated_at = NOW()
WHERE method = 'POST'
  AND route_pattern = '/admin/vendor/application/:applicationId/approve'
  AND action_name = 'customer_referral';
