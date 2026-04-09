-- PUT /medical-records/:recordId → ActionOccurred update_health_record (customerId + recordId in JSON body).
-- Requires loyalty_action_rules.action_name = 'update_health_record' (seeded in 043).
-- Idempotent without ON CONFLICT (some DBs lack unique on method+route_pattern+action_name).

INSERT INTO action_sources (
  source_type,
  route_pattern,
  method,
  status_min,
  status_max,
  success_predicate,
  action_name,
  entity_resolver,
  entity_type,
  reference_type,
  reference_id_resolver,
  metadata_resolvers,
  enabled,
  priority,
  dry_run,
  notes
)
SELECT
  'http',
  '/medical-records/:recordId',
  'PUT',
  200,
  299,
  '$.success',
  'update_health_record',
  '$.customerId',
  'customer',
  'medical_record',
  '$.recordId',
  '{}'::jsonb,
  true,
  100,
  false,
  'Customer medical record update; entity from customerId; reference recordId for audit'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a
  WHERE a.method = 'PUT'
    AND a.route_pattern = '/medical-records/:recordId'
    AND a.action_name = 'update_health_record'
);

-- If row already exists, refresh fields (same key).
UPDATE action_sources SET
  success_predicate = '$.success',
  entity_resolver = '$.customerId',
  entity_type = 'customer',
  reference_type = 'medical_record',
  reference_id_resolver = '$.recordId',
  metadata_resolvers = '{}'::jsonb,
  enabled = true,
  priority = 100,
  dry_run = false,
  notes = 'Customer medical record update; entity from customerId; reference recordId for audit',
  updated_at = NOW()
WHERE method = 'PUT'
  AND route_pattern = '/medical-records/:recordId'
  AND action_name = 'update_health_record';
