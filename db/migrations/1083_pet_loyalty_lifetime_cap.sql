-- 1083: Pet profile + vaccination loyalty — lifetime cap of 3 per customer (forward-only from apply time).
-- Idempotent.

-- ── 1. Extend frequency_type CHECK to include lifetime_limit ──
DO $$
DECLARE
  cname text;
BEGIN
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'loyalty_action_rules'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%frequency_type%'
  LOOP
    EXECUTE format('ALTER TABLE loyalty_action_rules DROP CONSTRAINT IF EXISTS %I', cname);
  END LOOP;
END $$;

ALTER TABLE loyalty_action_rules
  ADD CONSTRAINT loyalty_action_rules_frequency_type_check
  CHECK (
    frequency_type IS NULL
    OR frequency_type IN (
      'one_time',
      'recurring',
      'unlimited',
      'monthly_limit',
      'yearly_limit',
      'lifetime_limit'
    )
  );

-- ── 2. Rules: cap=3, forward-only cap_effective_from (set once) ──
UPDATE loyalty_action_rules SET
  frequency_type = 'lifetime_limit',
  frequency_limit = 3,
  description = 'Complete pet profile (max 3 per customer lifetime)',
  notes = '1083: Max 3 pet-profile loyalty awards per customer; forward-only cap from cap_effective_from',
  conditions = CASE
    WHEN COALESCE(conditions->>'cap_effective_from', '') = '' THEN
      jsonb_set(COALESCE(conditions, '{}'::jsonb), '{cap_effective_from}', to_jsonb(NOW()::timestamptz::text))
    ELSE conditions
  END,
  updated_at = NOW()
WHERE action_name = 'complete_pet_profile';

UPDATE loyalty_action_rules SET
  frequency_type = 'lifetime_limit',
  frequency_limit = 3,
  description = 'Update vaccination / health record digitally (max 3 per customer lifetime)',
  notes = '1083: Max 3 vaccination loyalty awards per customer; forward-only cap from cap_effective_from',
  conditions = CASE
    WHEN COALESCE(conditions->>'cap_effective_from', '') = '' THEN
      jsonb_set(COALESCE(conditions, '{}'::jsonb), '{cap_effective_from}', to_jsonb(NOW()::timestamptz::text))
    ELSE conditions
  END,
  updated_at = NOW()
WHERE action_name = 'update_health_record';

-- ── 3. complete_pet_profile action_sources (create-only) ──
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
  '$.success && $.petCreated == true',
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
  '1083: Pet create — repeat per loyaltyEligibleCreates entry'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a
  WHERE a.method = 'POST' AND a.route_pattern = '/pets' AND a.action_name = 'complete_pet_profile'
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
  '$.success && $.petCreated == true',
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
  '1083: Batch pet create — repeat per loyaltyEligibleCreates entry'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a
  WHERE a.method = 'POST' AND a.route_pattern = '/customer/pets' AND a.action_name = 'complete_pet_profile'
);

INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http',
  '/customer/:customerId/pets',
  'POST',
  200,
  299,
  '$.success && $.petCreated == true',
  'complete_pet_profile',
  'customer',
  '$.customerId',
  NULL,
  'pet',
  '$.petId',
  '{"_repeatArrayPath": "$.loyaltyEligibleCreates", "_repeatIdField": "petId"}'::jsonb,
  true,
  105,
  false,
  '1083: CustomerId pet create — repeat per loyaltyEligibleCreates entry'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a
  WHERE a.method = 'POST' AND a.route_pattern = '/customer/:customerId/pets' AND a.action_name = 'complete_pet_profile'
);

-- ── 4. Fix update_health_record on POST /customer/pets + repeat vaccination awards ──
UPDATE action_sources SET
  success_predicate = '$.success && $.vaccinationUpdated == true',
  entity_resolver = '$.customerId',
  entity_type = 'customer',
  reference_type = 'pet',
  reference_id_resolver = '$.petId',
  metadata_resolvers = '{"_repeatArrayPath": "$.loyaltyEligibleVaccinationUpdates", "_repeatIdField": "petId"}'::jsonb,
  enabled = true,
  priority = 105,
  dry_run = false,
  notes = COALESCE(notes, '') || ' [1083] Repeat per loyaltyEligibleVaccinationUpdates; entity from customerId.',
  updated_at = NOW()
WHERE action_name = 'update_health_record'
  AND method = 'POST'
  AND route_pattern = '/customer/pets';

UPDATE action_sources SET
  metadata_resolvers = '{"_repeatArrayPath": "$.loyaltyEligibleVaccinationUpdates", "_repeatIdField": "petId"}'::jsonb,
  updated_at = NOW()
WHERE action_name = 'update_health_record'
  AND method = 'POST'
  AND route_pattern = '/pets';

UPDATE action_sources SET
  metadata_resolvers = '{"_repeatArrayPath": "$.loyaltyEligibleVaccinationUpdates", "_repeatIdField": "petId"}'::jsonb,
  updated_at = NOW()
WHERE action_name = 'update_health_record'
  AND method = 'PUT'
  AND route_pattern = '/pets/:petId';
