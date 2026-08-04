-- Decouple nutrition meal catalog from ecommerce products.
-- meal_plans is the single source of truth. Prefer existing meal_plans rows over products twins
-- (e.g. Veg Bowl keeps meal_plans price/active). Orphans in products are backfilled, then scrubbed.

-- 1) Backfill meal-category products that do NOT already exist in meal_plans (same id).
INSERT INTO meal_plans (
  id,
  vendor_id,
  plan_name,
  name,
  description,
  price_per_meal,
  is_active,
  dietary_requirements,
  purchase_type,
  subscription_config,
  meal_image_url,
  created_at,
  updated_at
)
SELECT
  p.id,
  p.vendor_id,
  COALESCE(NULLIF(TRIM(p.name), ''), 'Meal') AS plan_name,
  NULLIF(TRIM(p.name), '') AS name,
  p.description,
  COALESCE(p.price, 0) AS price_per_meal,
  COALESCE(p.is_active, true) AS is_active,
  COALESCE(
    CASE
      WHEN p.metadata IS NOT NULL AND jsonb_typeof(p.metadata) = 'object' THEN p.metadata
      ELSE NULL
    END,
    CASE
      WHEN p.specifications IS NOT NULL AND jsonb_typeof(p.specifications) = 'object' THEN p.specifications
      ELSE NULL
    END,
    '{}'::jsonb
  ) AS dietary_requirements,
  NULLIF(TRIM(p.purchase_type), '') AS purchase_type,
  CASE
    WHEN p.subscription_config IS NOT NULL AND jsonb_typeof(p.subscription_config) = 'object'
      THEN p.subscription_config
    ELSE NULL
  END AS subscription_config,
  NULLIF(
    TRIM(
      COALESCE(
        p.metadata->>'mealImageUrl',
        p.specifications->>'mealImageUrl',
        ''
      )
    ),
    ''
  ) AS meal_image_url,
  COALESCE(p.created_at, NOW()),
  COALESCE(p.updated_at, NOW())
FROM products p
WHERE LOWER(COALESCE(NULLIF(TRIM(p.category::text), ''), '')) IN ('meal_plan', 'nutrition', 'food')
  AND p.vendor_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM meal_plans mp WHERE mp.id = p.id)
ON CONFLICT (id) DO NOTHING;

-- 2) Clear optional ecommerce child rows that reference meal-category products (dev/prod safety).
DELETE FROM cart_items
WHERE product_id IN (
  SELECT id FROM products
  WHERE LOWER(COALESCE(NULLIF(TRIM(category::text), ''), '')) IN ('meal_plan', 'nutrition', 'food')
);

DELETE FROM customer_wishlist
WHERE product_id IN (
  SELECT id FROM products
  WHERE LOWER(COALESCE(NULLIF(TRIM(category::text), ''), '')) IN ('meal_plan', 'nutrition', 'food')
);

DELETE FROM product_views
WHERE product_id IN (
  SELECT id FROM products
  WHERE LOWER(COALESCE(NULLIF(TRIM(category::text), ''), '')) IN ('meal_plan', 'nutrition', 'food')
);

DELETE FROM product_reviews
WHERE product_id IN (
  SELECT id FROM products
  WHERE LOWER(COALESCE(NULLIF(TRIM(category::text), ''), '')) IN ('meal_plan', 'nutrition', 'food')
);

DELETE FROM product_skus
WHERE product_id IN (
  SELECT id FROM products
  WHERE LOWER(COALESCE(NULLIF(TRIM(category::text), ''), '')) IN ('meal_plan', 'nutrition', 'food')
);

DELETE FROM product_variations
WHERE product_id IN (
  SELECT id FROM products
  WHERE LOWER(COALESCE(NULLIF(TRIM(category::text), ''), '')) IN ('meal_plan', 'nutrition', 'food')
);

DELETE FROM product_policies
WHERE product_id IN (
  SELECT id FROM products
  WHERE LOWER(COALESCE(NULLIF(TRIM(category::text), ''), '')) IN ('meal_plan', 'nutrition', 'food')
);

DELETE FROM product_commission_overrides
WHERE product_id IN (
  SELECT id FROM products
  WHERE LOWER(COALESCE(NULLIF(TRIM(category::text), ''), '')) IN ('meal_plan', 'nutrition', 'food')
);

-- 3) Remove meal catalog rows from products (including twins). meal_plans remains SoT.
DELETE FROM products
WHERE LOWER(COALESCE(NULLIF(TRIM(category::text), ''), '')) IN ('meal_plan', 'nutrition', 'food');
