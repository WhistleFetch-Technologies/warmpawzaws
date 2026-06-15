-- ============================================================================
-- 1036: Referral referee reward + vaccination-only health record loyalty
-- ============================================================================
-- 1) referral_signup (50 pts) for referred friend on first paid booking (Razorpay verify).
-- 2) Move update_health_record triggers from PUT /medical-records/:recordId to pet profile
--    vaccination saves (POST/PUT /pets). Disable prescription / generic record PUT awards.
-- 3) Remove any rogue action_sources on booking prescription upload routes.
-- ============================================================================

-- Referral signup rule: 50 points for referred friend (matches ReferralSystemPage UI)
INSERT INTO loyalty_action_rules (
  action_name,
  action_category,
  user_type,
  points_type,
  points_value,
  base_amount,
  frequency_type,
  description,
  notes,
  is_active,
  priority
) VALUES (
  'referral_signup',
  'referral_rewards',
  'customer',
  'fixed',
  50,
  NULL,
  'one_time',
  'Sign up with a friend''s referral code and complete first booking',
  '1036: Referee welcome bonus (referral_signup) on Razorpay booking verify',
  true,
  50
)
ON CONFLICT (action_name) DO UPDATE SET
  points_value = 50,
  action_category = 'referral_rewards',
  user_type = 'customer',
  points_type = 'fixed',
  frequency_type = 'one_time',
  description = EXCLUDED.description,
  notes = EXCLUDED.notes,
  is_active = true,
  updated_at = NOW();

-- Referee reward on same booking payment event as referrer (707)
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
  'referral_signup',
  'customer',
  '$.customerId',
  NULL,
  'booking',
  '$.bookingId',
  '{}'::jsonb,
  true,
  119,
  false,
  '1036: Referee referral_signup when referred customer pays for a booking'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a
  WHERE a.method = 'POST'
    AND a.route_pattern = '/razorpay/verify-payment'
    AND a.action_name = 'referral_signup'
);

UPDATE action_sources SET
  success_predicate = '$.success && $.bookingId',
  entity_resolver = '$.customerId',
  entity_type = 'customer',
  reference_type = 'booking',
  reference_id_resolver = '$.bookingId',
  enabled = true,
  priority = 119,
  dry_run = false,
  notes = '1036: Referee referral_signup on booking payment verified',
  updated_at = NOW()
WHERE method = 'POST'
  AND route_pattern = '/razorpay/verify-payment'
  AND action_name = 'referral_signup';

-- Stop awarding on generic medical record PUT (prescription uploads use POST, not PUT)
UPDATE action_sources SET
  enabled = false,
  notes = COALESCE(notes, '') || ' [1036] Disabled: update_health_record only for pet vaccination profile saves.',
  updated_at = NOW()
WHERE method = 'PUT'
  AND route_pattern = '/medical-records/:recordId'
  AND action_name = 'update_health_record';

-- Remove mistaken triggers on booking prescription upload if present
UPDATE action_sources SET
  enabled = false,
  notes = COALESCE(notes, '') || ' [1036] Disabled: prescription upload must not earn loyalty points.',
  updated_at = NOW()
WHERE route_pattern LIKE '%upload-prescription%'
   OR route_pattern LIKE '%upload_prescription%';

DELETE FROM action_sources
WHERE route_pattern LIKE '%upload-prescription%'
   OR route_pattern LIKE '%upload_prescription%';

-- Pet profile vaccination → update_health_record
INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http',
  '/pets',
  'POST',
  200,
  299,
  '$.success && $.vaccinationUpdated == true',
  'update_health_record',
  'customer',
  '$.customerId',
  NULL,
  'pet',
  '$.petId',
  '{}'::jsonb,
  true,
  105,
  false,
  '1036: Pet create with vaccination data in pet profile'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a
  WHERE a.method = 'POST' AND a.route_pattern = '/pets' AND a.action_name = 'update_health_record'
);

INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http',
  '/pets/:petId',
  'PUT',
  200,
  299,
  '$.success && $.vaccinationUpdated == true',
  'update_health_record',
  'customer',
  '$.customerId',
  NULL,
  'pet',
  '$.petId',
  '{}'::jsonb,
  true,
  105,
  false,
  '1036: Pet profile vaccination update'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a
  WHERE a.method = 'PUT' AND a.route_pattern = '/pets/:petId' AND a.action_name = 'update_health_record'
);

INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http',
  '/customer/pets',
  'POST',
  200,
  299,
  '$.success && $.vaccinationUpdated == true',
  'update_health_record',
  'customer',
  '$.customerId',
  NULL,
  'pet',
  '$.petId',
  '{}'::jsonb,
  true,
  104,
  false,
  '1036: Legacy customer/pets save with vaccination data'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a
  WHERE a.method = 'POST' AND a.route_pattern = '/customer/pets' AND a.action_name = 'update_health_record'
);

UPDATE action_sources SET
  success_predicate = '$.success && $.vaccinationUpdated == true',
  entity_resolver = '$.customerId',
  entity_type = 'customer',
  reference_type = 'pet',
  reference_id_resolver = '$.petId',
  enabled = true,
  priority = 105,
  dry_run = false,
  updated_at = NOW()
WHERE action_name = 'update_health_record'
  AND method = 'POST'
  AND route_pattern = '/pets';

UPDATE action_sources SET
  success_predicate = '$.success && $.vaccinationUpdated == true',
  entity_resolver = '$.customerId',
  entity_type = 'customer',
  reference_type = 'pet',
  reference_id_resolver = '$.petId',
  enabled = true,
  priority = 105,
  dry_run = false,
  updated_at = NOW()
WHERE action_name = 'update_health_record'
  AND method = 'PUT'
  AND route_pattern = '/pets/:petId';

UPDATE action_sources SET
  success_predicate = '$.success && $.vaccinationUpdated == true',
  entity_resolver = '$.customerId',
  entity_type = 'customer',
  reference_type = 'pet',
  reference_id_resolver = '$.petId',
  enabled = true,
  priority = 104,
  dry_run = false,
  updated_at = NOW()
WHERE action_name = 'update_health_record'
  AND method = 'POST'
  AND route_pattern = '/customer/pets';
