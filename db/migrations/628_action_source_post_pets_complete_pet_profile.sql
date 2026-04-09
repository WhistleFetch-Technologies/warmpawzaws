-- POST /pets → ActionOccurred complete_pet_profile (customer id from JSON response pet.customer_id).
-- loyalty_action_rules.complete_pet_profile is seeded in 043; this migration only adds the HTTP trigger.
-- Idempotent: unique (method, route_pattern, action_name) on action_sources.

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
  metadata_resolvers,
  enabled,
  priority,
  dry_run,
  notes
) VALUES (
  'http',
  '/pets',
  'POST',
  200,
  299,
  '$.success',
  'complete_pet_profile',
  '$.pet.customer_id',
  'customer',
  '{}'::jsonb,
  true,
  100,
  false,
  'Customer creates pet via POST /pets; entity from response pet.customer_id; one_time rule in loyalty_action_rules'
)
ON CONFLICT (method, route_pattern, action_name) DO NOTHING;
