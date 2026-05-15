-- 711: Idempotent ensure purchase_pet_food loyalty rule + action_sources (POST /ecommerce/orders, POST /orders).
-- Safe to re-run on dev/prod.

INSERT INTO loyalty_action_rules (
  action_name, action_category, user_type, points_type, points_value, base_amount,
  frequency_type, description, notes, is_active, priority
) VALUES (
  'purchase_pet_food', 'loyalty', 'customer', 'per_amount', 25, 1000,
  'unlimited', 'Purchase pet food', '25 points per ₹1000 — platform shop [711]', true, 100
)
ON CONFLICT (action_name) DO UPDATE SET
  action_category = EXCLUDED.action_category,
  user_type = EXCLUDED.user_type,
  points_type = EXCLUDED.points_type,
  points_value = EXCLUDED.points_value,
  base_amount = EXCLUDED.base_amount,
  frequency_type = EXCLUDED.frequency_type,
  description = EXCLUDED.description,
  notes = EXCLUDED.notes,
  is_active = EXCLUDED.is_active,
  priority = EXCLUDED.priority,
  updated_at = NOW();

-- POST /ecommerce/orders → purchase_pet_food
INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http', '/ecommerce/orders', 'POST', 200, 299,
  '$.success && $.isFirstPlatformProductOrder == false && $.containsPetFood == true',
  'purchase_pet_food', 'customer', '$.customerId', '$.totalAmount', 'order', '$.order.id',
  '{}'::jsonb, true, 100, false,
  'E-commerce order with pet-food heuristic [711]'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a
  WHERE a.method = 'POST' AND a.route_pattern = '/ecommerce/orders' AND a.action_name = 'purchase_pet_food'
);
UPDATE action_sources SET
  success_predicate = '$.success && $.isFirstPlatformProductOrder == false && $.containsPetFood == true',
  entity_resolver = '$.customerId',
  entity_type = 'customer',
  amount_resolver = '$.totalAmount',
  reference_type = 'order',
  reference_id_resolver = '$.order.id',
  metadata_resolvers = '{}'::jsonb,
  enabled = true,
  priority = 100,
  dry_run = false,
  notes = 'E-commerce order with pet-food heuristic [711]',
  updated_at = NOW()
WHERE method = 'POST' AND route_pattern = '/ecommerce/orders' AND action_name = 'purchase_pet_food';

-- POST /orders → purchase_pet_food (legacy path)
INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http', '/orders', 'POST', 200, 299,
  '$.success && $.isFirstPlatformProductOrder == false && $.containsPetFood == true',
  'purchase_pet_food', 'customer', '$.customerId', '$.totalAmount', 'order', '$.orderId',
  '{}'::jsonb, true, 100, false,
  'POST /orders pet food branch [711]'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a
  WHERE a.method = 'POST' AND a.route_pattern = '/orders' AND a.action_name = 'purchase_pet_food'
);
UPDATE action_sources SET
  success_predicate = '$.success && $.isFirstPlatformProductOrder == false && $.containsPetFood == true',
  entity_resolver = '$.customerId',
  entity_type = 'customer',
  amount_resolver = '$.totalAmount',
  reference_type = 'order',
  reference_id_resolver = '$.orderId',
  metadata_resolvers = '{}'::jsonb,
  enabled = true,
  priority = 100,
  dry_run = false,
  notes = 'POST /orders pet food branch [711]',
  updated_at = NOW()
WHERE method = 'POST' AND route_pattern = '/orders' AND action_name = 'purchase_pet_food';
