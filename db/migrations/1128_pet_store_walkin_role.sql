-- ============================================================================
-- MIGRATION 1128: Pet Store walk-in role (Warmpawz Pay sub-channel)
-- ============================================================================
-- Additive. Does not alias seller / shop / ecommerce.
-- Internal slug pet_store_walkin; onboarding label Pet Store.
-- customer_service = store (not shop) so Seller Hub never opens.
-- ============================================================================

-- 0) Allow customer_service = store (not shop) so Seller Hub never opens
ALTER TABLE roles
  DROP CONSTRAINT IF EXISTS roles_customer_service_check;

ALTER TABLE roles
  ADD CONSTRAINT roles_customer_service_check
  CHECK (customer_service IS NULL OR customer_service IN (
    'vet', 'grooming', 'training', 'shop', 'walker', 'boarding',
    'adoption', 'cafes', 'photography', 'insurance', 'breeder',
    'ambulance', 'nutritionist', 'relocation', 'resort', 'holiday',
    'sunset', 'sitter', 'store'
  ));

-- 1) Role
INSERT INTO roles (name, display_name, description, is_system_role, is_active, customer_service, config)
VALUES (
  'pet_store_walkin',
  'Pet Store',
  'Walk-in pet store on Warmpawz Pay. No service catalogue and no ecommerce catalogue.',
  true,
  true,
  'store',
  '{
    "category": "retail",
    "customer_service": "store",
    "vendorConfiguration": "business",
    "vendorTypes": ["service_provider"],
    "serviceStyles": {
      "solo": [],
      "business": ["at_center"],
      "selected": ["at_center"]
    },
    "pricingControl": { "canControlPrice": false, "canControlDuration": false },
    "capabilities": [
      "dashboard",
      "profile",
      "gallery",
      "earnings",
      "chat",
      "notifications",
      "schedule",
      "settlements",
      "bank_account"
    ]
  }'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  is_active = true,
  customer_service = EXCLUDED.customer_service,
  config = EXCLUDED.config,
  updated_at = NOW();

-- 2) Capabilities — only the allowed set (never bookings/catalog/services/products/inventory)
INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, cap, '*', '*'
FROM roles r
CROSS JOIN unnest(ARRAY[
  'dashboard',
  'profile',
  'gallery',
  'earnings',
  'chat',
  'notifications',
  'schedule',
  'settlements',
  'bank_account'
]) AS cap
WHERE r.name = 'pet_store_walkin'
  AND NOT EXISTS (
    SELECT 1
    FROM role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.permission_name = cap
      AND rp.resource = '*'
      AND rp.action = '*'
  );

-- 3) Onboarding form — copy published seller fields when present
INSERT INTO onboarding_forms (role_id, vendor_type, fields, sections, version, status, updated_at)
SELECT
  'pet_store_walkin',
  COALESCE(NULLIF(TRIM(vendor_type), ''), 'center'),
  fields,
  sections,
  version,
  COALESCE(status, 'published'),
  NOW()
FROM onboarding_forms
WHERE lower(role_id) IN ('seller', 'pet_products_store')
ORDER BY CASE WHEN lower(role_id) = 'seller' THEN 0 ELSE 1 END
LIMIT 1
ON CONFLICT (role_id, vendor_type) DO UPDATE SET
  fields = EXCLUDED.fields,
  sections = EXCLUDED.sections,
  version = EXCLUDED.version,
  status = EXCLUDED.status,
  updated_at = NOW();

-- 4) Promo / Pay Bill catalogue category (not ecommerce / pet shop)
INSERT INTO service_categories (category_id, name, description, icon, icon_color, display_order, is_active, vendor_roles)
SELECT
  'store',
  'Store',
  'Walk-in pet store on Warmpawz Pay',
  'ShoppingBag',
  'text-orange-600',
  40,
  true,
  ARRAY['pet_store_walkin']::text[]
WHERE NOT EXISTS (
  SELECT 1 FROM service_categories WHERE category_id = 'store'
);

UPDATE service_categories
SET vendor_roles = ARRAY(
  SELECT DISTINCT r
  FROM unnest(COALESCE(vendor_roles, '{}'::text[]) || ARRAY['pet_store_walkin']::text[]) AS r
  ORDER BY r
),
    is_active = true,
    updated_at = NOW()
WHERE category_id = 'store'
  AND NOT ('pet_store_walkin' = ANY (COALESCE(vendor_roles, '{}'::text[])));

-- 5) Product specializations — profile picker only
INSERT INTO specialization_master (
  specialization_id, name, display_name, description, category_id,
  applicable_roles, icon_name, icon_color, display_order, is_active,
  show_in_problem_grid, show_in_vendor_profile, show_in_services_dashboard,
  allowed_service_styles
)
VALUES
  ('store_pet_food', 'Pet Food', 'Pet Food', 'Food and treats', 'store',
   ARRAY['pet_store_walkin']::text[], 'Bone', 'text-orange-600', 1, true,
   false, true, false, '["at_center"]'::jsonb),
  ('store_accessories', 'Accessories', 'Accessories', 'Collars, leashes, bowls', 'store',
   ARRAY['pet_store_walkin']::text[], 'ShoppingBag', 'text-orange-600', 2, true,
   false, true, false, '["at_center"]'::jsonb),
  ('store_toys', 'Toys', 'Toys', 'Chew and play toys', 'store',
   ARRAY['pet_store_walkin']::text[], 'Puzzle', 'text-orange-600', 3, true,
   false, true, false, '["at_center"]'::jsonb),
  ('store_grooming', 'Grooming', 'Grooming', 'Shampoo, brushes, care products', 'store',
   ARRAY['pet_store_walkin']::text[], 'Scissors', 'text-pink-600', 4, true,
   false, true, false, '["at_center"]'::jsonb),
  ('store_health', 'Health', 'Health', 'Supplements and wellness products', 'store',
   ARRAY['pet_store_walkin']::text[], 'Heart', 'text-red-500', 5, true,
   false, true, false, '["at_center"]'::jsonb),
  ('store_beds', 'Beds', 'Beds', 'Beds and resting products', 'store',
   ARRAY['pet_store_walkin']::text[], 'Home', 'text-amber-600', 6, true,
   false, true, false, '["at_center"]'::jsonb),
  ('store_clothing', 'Clothing', 'Clothing', 'Apparel and seasonal wear', 'store',
   ARRAY['pet_store_walkin']::text[], 'Shirt', 'text-indigo-600', 7, true,
   false, true, false, '["at_center"]'::jsonb),
  ('store_travel', 'Travel', 'Travel', 'Carriers and travel gear', 'store',
   ARRAY['pet_store_walkin']::text[], 'Plane', 'text-sky-600', 8, true,
   false, true, false, '["at_center"]'::jsonb),
  ('store_pharmacy', 'Pharmacy', 'Pharmacy', 'OTC pet pharmacy products', 'store',
   ARRAY['pet_store_walkin']::text[], 'Pill', 'text-green-600', 9, true,
   false, true, false, '["at_center"]'::jsonb),
  ('store_training', 'Training', 'Training', 'Training aids and treats', 'store',
   ARRAY['pet_store_walkin']::text[], 'GraduationCap', 'text-violet-600', 10, true,
   false, true, false, '["at_center"]'::jsonb)
ON CONFLICT (specialization_id) DO UPDATE SET
  name = EXCLUDED.name,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  category_id = EXCLUDED.category_id,
  applicable_roles = EXCLUDED.applicable_roles,
  show_in_problem_grid = false,
  show_in_vendor_profile = true,
  show_in_services_dashboard = false,
  is_active = true,
  updated_at = NOW();
