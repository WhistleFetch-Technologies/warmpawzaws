-- 1087: Award complete_pet_profile only when the saved pet profile is complete.
-- Predicate change is required because action-source-middleware publishes once
-- when loyaltyEligibleCreates is empty and petCreated is true.
-- Idempotent.

UPDATE action_sources SET
  success_predicate = '$.success && $.petProfileCompleted == true',
  notes = COALESCE(notes, '') || ' [1087] Award only when petProfileCompleted.',
  updated_at = NOW()
WHERE action_name = 'complete_pet_profile';

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
  '$.success && $.petProfileCompleted == true',
  'complete_pet_profile',
  'customer',
  '$.customerId',
  NULL,
  'pet',
  '$.petId',
  '{"_repeatArrayPath": "$.loyaltyEligibleCreates", "_repeatIdField": "petId"}'::jsonb,
  true,
  106,
  false,
  '1087: Award complete_pet_profile when an update first completes the profile'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a
  WHERE a.method = 'PUT'
    AND a.route_pattern = '/pets/:petId'
    AND a.action_name = 'complete_pet_profile'
);

INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http',
  '/customer/:phone/pets/:petId',
  'PUT',
  200,
  299,
  '$.success && $.petProfileCompleted == true',
  'complete_pet_profile',
  'customer',
  '$.customerId',
  NULL,
  'pet',
  '$.petId',
  '{"_repeatArrayPath": "$.loyaltyEligibleCreates", "_repeatIdField": "petId"}'::jsonb,
  true,
  106,
  false,
  '1087: Phone pet update — award when profile first becomes complete'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a
  WHERE a.method = 'PUT'
    AND a.route_pattern = '/customer/:phone/pets/:petId'
    AND a.action_name = 'complete_pet_profile'
);
