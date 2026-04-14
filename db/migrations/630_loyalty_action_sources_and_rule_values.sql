-- Align loyalty_action_rules with rewards sheet (rows 3–15 area) and wire action_sources.
-- Booking responses use BaseHandler shape: { success, data: { customerId, loyaltyServiceKind, ... }, meta }.
-- refer_friend (delay until referred user’s first booking) and birthday_month_booking (coupon) stay out of HTTP action_sources.
-- Idempotent without ON CONFLICT (RDS may lack uq_action_sources_method_route_action).

-- Rule numeric / frequency updates
UPDATE loyalty_action_rules SET points_value = 30, base_amount = 1000, updated_at = NOW() WHERE action_name = 'buy_medicine';
UPDATE loyalty_action_rules SET points_value = 15, base_amount = 500, updated_at = NOW() WHERE action_name = 'book_grooming';
UPDATE loyalty_action_rules SET points_value = 15, base_amount = 500, updated_at = NOW() WHERE action_name = 'book_vet_consultation';
UPDATE loyalty_action_rules SET points_value = 25, base_amount = 1000, updated_at = NOW() WHERE action_name = 'purchase_pet_food';
UPDATE loyalty_action_rules SET points_value = 15, base_amount = 1000, updated_at = NOW() WHERE action_name = 'book_nutrition_consultation';
UPDATE loyalty_action_rules SET points_value = 30, base_amount = 1000, updated_at = NOW() WHERE action_name = 'buy_product';
UPDATE loyalty_action_rules SET points_value = 75, points_type = 'fixed', base_amount = NULL, frequency_type = 'monthly_limit', frequency_limit = 3, frequency_period = 'month', updated_at = NOW() WHERE action_name = 'post_review';

-- Do not award vet consultation on generic payment routes (use booking create + loyaltyServiceKind).
UPDATE action_sources SET enabled = false, updated_at = NOW(), notes = COALESCE(notes, '') || ' [630] Disabled: use POST /bookings/create with data.loyaltyServiceKind=vet_consultation.'
WHERE action_name = 'book_vet_consultation'
  AND route_pattern IN ('/payments/create', '/payments/verify', '/razorpay/create-order');

-- POST /bookings/create
INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http', '/bookings/create', 'POST', 200, 299,
  '$.success && $.data.isNew == true && $.data.loyaltyServiceKind == grooming',
  'book_grooming', 'customer', '$.data.customerId', '$.data.totalAmount', 'booking', '$.data.bookingId',
  '{}'::jsonb, true, 120, false,
  'Grooming: create booking — predicate on data.loyaltyServiceKind (BaseHandler wrapper)'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a WHERE a.method = 'POST' AND a.route_pattern = '/bookings/create' AND a.action_name = 'book_grooming'
);
UPDATE action_sources SET
  success_predicate = '$.success && $.data.isNew == true && $.data.loyaltyServiceKind == grooming',
  entity_resolver = '$.data.customerId',
  entity_type = 'customer',
  amount_resolver = '$.data.totalAmount',
  reference_type = 'booking',
  reference_id_resolver = '$.data.bookingId',
  metadata_resolvers = '{}'::jsonb,
  enabled = true,
  priority = 120,
  dry_run = false,
  notes = 'Grooming: create booking — predicate on data.loyaltyServiceKind (BaseHandler wrapper)',
  updated_at = NOW()
WHERE method = 'POST' AND route_pattern = '/bookings/create' AND action_name = 'book_grooming';

INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http', '/bookings/create', 'POST', 200, 299,
  '$.success && $.data.isNew == true && $.data.loyaltyServiceKind == vet_consultation',
  'book_vet_consultation', 'customer', '$.data.customerId', '$.data.totalAmount', 'booking', '$.data.bookingId',
  '{}'::jsonb, true, 120, false,
  'Vet consultation: create booking — not generic payment routes'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a WHERE a.method = 'POST' AND a.route_pattern = '/bookings/create' AND a.action_name = 'book_vet_consultation'
);
UPDATE action_sources SET
  success_predicate = '$.success && $.data.isNew == true && $.data.loyaltyServiceKind == vet_consultation',
  entity_resolver = '$.data.customerId',
  entity_type = 'customer',
  amount_resolver = '$.data.totalAmount',
  reference_type = 'booking',
  reference_id_resolver = '$.data.bookingId',
  metadata_resolvers = '{}'::jsonb,
  enabled = true,
  priority = 120,
  dry_run = false,
  notes = 'Vet consultation: create booking — not generic payment routes',
  updated_at = NOW()
WHERE method = 'POST' AND route_pattern = '/bookings/create' AND action_name = 'book_vet_consultation';

INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http', '/bookings/create', 'POST', 200, 299,
  '$.success && $.data.isNew == true && $.data.loyaltyServiceKind == nutrition_consultation',
  'book_nutrition_consultation', 'customer', '$.data.customerId', '$.data.totalAmount', 'booking', '$.data.bookingId',
  '{}'::jsonb, true, 120, false,
  'Nutrition consultation booking'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a WHERE a.method = 'POST' AND a.route_pattern = '/bookings/create' AND a.action_name = 'book_nutrition_consultation'
);
UPDATE action_sources SET
  success_predicate = '$.success && $.data.isNew == true && $.data.loyaltyServiceKind == nutrition_consultation',
  entity_resolver = '$.data.customerId',
  entity_type = 'customer',
  amount_resolver = '$.data.totalAmount',
  reference_type = 'booking',
  reference_id_resolver = '$.data.bookingId',
  metadata_resolvers = '{}'::jsonb,
  enabled = true,
  priority = 120,
  dry_run = false,
  notes = 'Nutrition consultation booking',
  updated_at = NOW()
WHERE method = 'POST' AND route_pattern = '/bookings/create' AND action_name = 'book_nutrition_consultation';

-- /customer/bookings/create
INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http', '/customer/bookings/create', 'POST', 200, 299,
  '$.success && $.data.isNew == true && $.data.loyaltyServiceKind == grooming',
  'book_grooming', 'customer', '$.data.customerId', '$.data.totalAmount', 'booking', '$.data.bookingId',
  '{}'::jsonb, true, 120, false,
  'Grooming: customer/bookings/create alias'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a WHERE a.method = 'POST' AND a.route_pattern = '/customer/bookings/create' AND a.action_name = 'book_grooming'
);
UPDATE action_sources SET
  success_predicate = '$.success && $.data.isNew == true && $.data.loyaltyServiceKind == grooming',
  entity_resolver = '$.data.customerId',
  entity_type = 'customer',
  amount_resolver = '$.data.totalAmount',
  reference_type = 'booking',
  reference_id_resolver = '$.data.bookingId',
  metadata_resolvers = '{}'::jsonb,
  enabled = true,
  priority = 120,
  dry_run = false,
  notes = 'Grooming: customer/bookings/create alias',
  updated_at = NOW()
WHERE method = 'POST' AND route_pattern = '/customer/bookings/create' AND action_name = 'book_grooming';

INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http', '/customer/bookings/create', 'POST', 200, 299,
  '$.success && $.data.isNew == true && $.data.loyaltyServiceKind == vet_consultation',
  'book_vet_consultation', 'customer', '$.data.customerId', '$.data.totalAmount', 'booking', '$.data.bookingId',
  '{}'::jsonb, true, 120, false,
  'Vet: customer/bookings/create alias'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a WHERE a.method = 'POST' AND a.route_pattern = '/customer/bookings/create' AND a.action_name = 'book_vet_consultation'
);
UPDATE action_sources SET
  success_predicate = '$.success && $.data.isNew == true && $.data.loyaltyServiceKind == vet_consultation',
  entity_resolver = '$.data.customerId',
  entity_type = 'customer',
  amount_resolver = '$.data.totalAmount',
  reference_type = 'booking',
  reference_id_resolver = '$.data.bookingId',
  metadata_resolvers = '{}'::jsonb,
  enabled = true,
  priority = 120,
  dry_run = false,
  notes = 'Vet: customer/bookings/create alias',
  updated_at = NOW()
WHERE method = 'POST' AND route_pattern = '/customer/bookings/create' AND action_name = 'book_vet_consultation';

INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http', '/customer/bookings/create', 'POST', 200, 299,
  '$.success && $.data.isNew == true && $.data.loyaltyServiceKind == nutrition_consultation',
  'book_nutrition_consultation', 'customer', '$.data.customerId', '$.data.totalAmount', 'booking', '$.data.bookingId',
  '{}'::jsonb, true, 120, false,
  'Nutrition: customer/bookings/create alias'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a WHERE a.method = 'POST' AND a.route_pattern = '/customer/bookings/create' AND a.action_name = 'book_nutrition_consultation'
);
UPDATE action_sources SET
  success_predicate = '$.success && $.data.isNew == true && $.data.loyaltyServiceKind == nutrition_consultation',
  entity_resolver = '$.data.customerId',
  entity_type = 'customer',
  amount_resolver = '$.data.totalAmount',
  reference_type = 'booking',
  reference_id_resolver = '$.data.bookingId',
  metadata_resolvers = '{}'::jsonb,
  enabled = true,
  priority = 120,
  dry_run = false,
  notes = 'Nutrition: customer/bookings/create alias',
  updated_at = NOW()
WHERE method = 'POST' AND route_pattern = '/customer/bookings/create' AND action_name = 'book_nutrition_consultation';

-- Pharmacy payment
INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http', '/pharmacy/orders/:orderId/payment', 'POST', 200, 299,
  '$.success',
  'buy_medicine', 'customer', '$.customerId', '$.totalAmount', 'pharmacy_order', '$.param.orderId',
  '{}'::jsonb, true, 100, false,
  'Medicine order paid or COD confirmed — amount from order row'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a WHERE a.method = 'POST' AND a.route_pattern = '/pharmacy/orders/:orderId/payment' AND a.action_name = 'buy_medicine'
);
UPDATE action_sources SET
  success_predicate = '$.success',
  entity_resolver = '$.customerId',
  entity_type = 'customer',
  amount_resolver = '$.totalAmount',
  reference_type = 'pharmacy_order',
  reference_id_resolver = '$.param.orderId',
  metadata_resolvers = '{}'::jsonb,
  enabled = true,
  priority = 100,
  dry_run = false,
  notes = 'Medicine order paid or COD confirmed — amount from order row',
  updated_at = NOW()
WHERE method = 'POST' AND route_pattern = '/pharmacy/orders/:orderId/payment' AND action_name = 'buy_medicine';

-- Insurance
INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http', '/customer/insurance/purchase', 'POST', 200, 299,
  '$.success && $.isInsuranceRenewal == false',
  'buy_insurance', 'customer', '$.policy.customer_id', '$.policy.premium_amount', 'insurance_policy', '$.policy.id',
  '{}'::jsonb, true, 100, false,
  'First platform insurance purchase for pet (per prior policy count)'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a WHERE a.method = 'POST' AND a.route_pattern = '/customer/insurance/purchase' AND a.action_name = 'buy_insurance'
);
UPDATE action_sources SET
  success_predicate = '$.success && $.isInsuranceRenewal == false',
  entity_resolver = '$.policy.customer_id',
  entity_type = 'customer',
  amount_resolver = '$.policy.premium_amount',
  reference_type = 'insurance_policy',
  reference_id_resolver = '$.policy.id',
  metadata_resolvers = '{}'::jsonb,
  enabled = true,
  priority = 100,
  dry_run = false,
  notes = 'First platform insurance purchase for pet (per prior policy count)',
  updated_at = NOW()
WHERE method = 'POST' AND route_pattern = '/customer/insurance/purchase' AND action_name = 'buy_insurance';

INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http', '/customer/insurance/purchase', 'POST', 200, 299,
  '$.success && $.isInsuranceRenewal == true',
  'renew_insurance', 'customer', '$.policy.customer_id', '$.policy.premium_amount', 'insurance_policy', '$.policy.id',
  '{}'::jsonb, true, 100, false,
  'Renewal when customer already had a policy row for this pet'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a WHERE a.method = 'POST' AND a.route_pattern = '/customer/insurance/purchase' AND a.action_name = 'renew_insurance'
);
UPDATE action_sources SET
  success_predicate = '$.success && $.isInsuranceRenewal == true',
  entity_resolver = '$.policy.customer_id',
  entity_type = 'customer',
  amount_resolver = '$.policy.premium_amount',
  reference_type = 'insurance_policy',
  reference_id_resolver = '$.policy.id',
  metadata_resolvers = '{}'::jsonb,
  enabled = true,
  priority = 100,
  dry_run = false,
  notes = 'Renewal when customer already had a policy row for this pet',
  updated_at = NOW()
WHERE method = 'POST' AND route_pattern = '/customer/insurance/purchase' AND action_name = 'renew_insurance';

-- E-commerce /orders
INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http', '/ecommerce/orders', 'POST', 200, 299,
  '$.success && $.isFirstPlatformProductOrder == true',
  'buy_first_product', 'customer', '$.customerId', '$.totalAmount', 'order', '$.order.id',
  '{}'::jsonb, true, 110, false,
  'First customer order on platform (order count before insert = 0)'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a WHERE a.method = 'POST' AND a.route_pattern = '/ecommerce/orders' AND a.action_name = 'buy_first_product'
);
UPDATE action_sources SET
  success_predicate = '$.success && $.isFirstPlatformProductOrder == true',
  entity_resolver = '$.customerId',
  entity_type = 'customer',
  amount_resolver = '$.totalAmount',
  reference_type = 'order',
  reference_id_resolver = '$.order.id',
  metadata_resolvers = '{}'::jsonb,
  enabled = true,
  priority = 110,
  dry_run = false,
  notes = 'First customer order on platform (order count before insert = 0)',
  updated_at = NOW()
WHERE method = 'POST' AND route_pattern = '/ecommerce/orders' AND action_name = 'buy_first_product';

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
  'Subsequent order with pet food heuristic in product name'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a WHERE a.method = 'POST' AND a.route_pattern = '/ecommerce/orders' AND a.action_name = 'purchase_pet_food'
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
  notes = 'Subsequent order with pet food heuristic in product name',
  updated_at = NOW()
WHERE method = 'POST' AND route_pattern = '/ecommerce/orders' AND action_name = 'purchase_pet_food';

INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http', '/ecommerce/orders', 'POST', 200, 299,
  '$.success && $.isFirstPlatformProductOrder == false && $.containsPetFood == false',
  'buy_product', 'customer', '$.customerId', '$.totalAmount', 'order', '$.order.id',
  '{}'::jsonb, true, 100, false,
  'Subsequent non-pet-food product order'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a WHERE a.method = 'POST' AND a.route_pattern = '/ecommerce/orders' AND a.action_name = 'buy_product'
);
UPDATE action_sources SET
  success_predicate = '$.success && $.isFirstPlatformProductOrder == false && $.containsPetFood == false',
  entity_resolver = '$.customerId',
  entity_type = 'customer',
  amount_resolver = '$.totalAmount',
  reference_type = 'order',
  reference_id_resolver = '$.order.id',
  metadata_resolvers = '{}'::jsonb,
  enabled = true,
  priority = 100,
  dry_run = false,
  notes = 'Subsequent non-pet-food product order',
  updated_at = NOW()
WHERE method = 'POST' AND route_pattern = '/ecommerce/orders' AND action_name = 'buy_product';

-- POST /orders
INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http', '/orders', 'POST', 200, 299,
  '$.success && $.isFirstPlatformProductOrder == true',
  'buy_first_product', 'customer', '$.customerId', '$.totalAmount', 'order', '$.orderId',
  '{}'::jsonb, true, 110, false,
  'POST /orders first purchase branch'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a WHERE a.method = 'POST' AND a.route_pattern = '/orders' AND a.action_name = 'buy_first_product'
);
UPDATE action_sources SET
  success_predicate = '$.success && $.isFirstPlatformProductOrder == true',
  entity_resolver = '$.customerId',
  entity_type = 'customer',
  amount_resolver = '$.totalAmount',
  reference_type = 'order',
  reference_id_resolver = '$.orderId',
  metadata_resolvers = '{}'::jsonb,
  enabled = true,
  priority = 110,
  dry_run = false,
  notes = 'POST /orders first purchase branch',
  updated_at = NOW()
WHERE method = 'POST' AND route_pattern = '/orders' AND action_name = 'buy_first_product';

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
  'POST /orders pet food branch'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a WHERE a.method = 'POST' AND a.route_pattern = '/orders' AND a.action_name = 'purchase_pet_food'
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
  notes = 'POST /orders pet food branch',
  updated_at = NOW()
WHERE method = 'POST' AND route_pattern = '/orders' AND action_name = 'purchase_pet_food';

INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http', '/orders', 'POST', 200, 299,
  '$.success && $.isFirstPlatformProductOrder == false && $.containsPetFood == false',
  'buy_product', 'customer', '$.customerId', '$.totalAmount', 'order', '$.orderId',
  '{}'::jsonb, true, 100, false,
  'POST /orders repeat product branch'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a WHERE a.method = 'POST' AND a.route_pattern = '/orders' AND a.action_name = 'buy_product'
);
UPDATE action_sources SET
  success_predicate = '$.success && $.isFirstPlatformProductOrder == false && $.containsPetFood == false',
  entity_resolver = '$.customerId',
  entity_type = 'customer',
  amount_resolver = '$.totalAmount',
  reference_type = 'order',
  reference_id_resolver = '$.orderId',
  metadata_resolvers = '{}'::jsonb,
  enabled = true,
  priority = 100,
  dry_run = false,
  notes = 'POST /orders repeat product branch',
  updated_at = NOW()
WHERE method = 'POST' AND route_pattern = '/orders' AND action_name = 'buy_product';

-- Product reviews
INSERT INTO action_sources (
  source_type, route_pattern, method, status_min, status_max, success_predicate,
  action_name, entity_type, entity_resolver, amount_resolver, reference_type, reference_id_resolver,
  metadata_resolvers, enabled, priority, dry_run, notes
)
SELECT
  'http', '/products/:productId/reviews', 'POST', 200, 299,
  '$.success && $.verifiedPurchase == true',
  'post_review', 'customer', '$.customerId', NULL, 'product_review', '$.reviewId',
  '{}'::jsonb, true, 100, false,
  'Verified purchase review only — monthly cap in loyalty_action_rules'
WHERE NOT EXISTS (
  SELECT 1 FROM action_sources a WHERE a.method = 'POST' AND a.route_pattern = '/products/:productId/reviews' AND a.action_name = 'post_review'
);
UPDATE action_sources SET
  success_predicate = '$.success && $.verifiedPurchase == true',
  entity_resolver = '$.customerId',
  entity_type = 'customer',
  amount_resolver = NULL,
  reference_type = 'product_review',
  reference_id_resolver = '$.reviewId',
  metadata_resolvers = '{}'::jsonb,
  enabled = true,
  priority = 100,
  dry_run = false,
  notes = 'Verified purchase review only — monthly cap in loyalty_action_rules',
  updated_at = NOW()
WHERE method = 'POST' AND route_pattern = '/products/:productId/reviews' AND action_name = 'post_review';
