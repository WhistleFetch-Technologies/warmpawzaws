-- ============================================================================
-- MIGRATION 1109: Product-level delivery lead time (min/max days)
-- ============================================================================
-- Optional extra days before the existing 2–3 / 4–5 state courier SLA.
-- Both NULL = standard courier only. Both set: 0 ≤ min ≤ max ≤ 365.
-- Backfill: The Wooden Store Beds & Furniture → 35–42 days (5–6 weeks).
-- ============================================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS lead_time_min_days INTEGER,
  ADD COLUMN IF NOT EXISTS lead_time_max_days INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_lead_time_days_check'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_lead_time_days_check
      CHECK (
        (lead_time_min_days IS NULL AND lead_time_max_days IS NULL)
        OR (
          lead_time_min_days IS NOT NULL
          AND lead_time_max_days IS NOT NULL
          AND lead_time_min_days >= 0
          AND lead_time_max_days >= 0
          AND lead_time_min_days <= 365
          AND lead_time_max_days <= 365
          AND lead_time_min_days <= lead_time_max_days
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN products.lead_time_min_days IS
  'Optional extra dispatch/prep days before courier SLA. NULL with max = standard 2–5 day delivery.';
COMMENT ON COLUMN products.lead_time_max_days IS
  'Optional extra dispatch/prep days (upper bound). Must be set with lead_time_min_days.';

-- Wooden Store furniture only. Idempotent: skip rows that already have lead time.
UPDATE products p
SET
  lead_time_min_days = 35,
  lead_time_max_days = 42
FROM vendors v
WHERE p.vendor_id = v.id
  AND v.business_name ILIKE '%wooden store%'
  AND p.lead_time_min_days IS NULL
  AND p.lead_time_max_days IS NULL
  AND (
    p.category ILIKE '%furniture%'
    OR EXISTS (
      SELECT 1
      FROM ecommerce_categories c
      WHERE c.id = p.category_id
        AND (
          c.name ILIKE '%Beds & Furniture%'
          OR c.name ILIKE '%furniture%'
          OR c.parent_category_id IN (
            SELECT id FROM ecommerce_categories
            WHERE name ILIKE '%Beds & Furniture%' OR name ILIKE 'Pet Beds & Furniture'
          )
        )
    )
    OR EXISTS (
      SELECT 1
      FROM product_category_links pcl
      JOIN ecommerce_categories c ON c.id = pcl.subcategory_id
      WHERE pcl.product_id = p.id
        AND (
          c.name ILIKE '%Beds & Furniture%'
          OR c.name ILIKE '%furniture%'
          OR c.parent_category_id IN (
            SELECT id FROM ecommerce_categories
            WHERE name ILIKE '%Beds & Furniture%' OR name ILIKE 'Pet Beds & Furniture'
          )
        )
    )
  );
