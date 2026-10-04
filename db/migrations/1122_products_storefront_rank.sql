-- ============================================================================
-- MIGRATION 1122: Storefront product rank (merchandising order)
-- GET /ecommerce/products default sort (popular) orders by storefront_rank ASC
-- first, then the existing review_count DESC NULLS LAST, created_at DESC.
--   0 (default) = normal position; higher = shown later; negative = promoted.
-- Explicit sorts (price_low / price_high / newest / rating) ignore the rank.
-- ============================================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS storefront_rank INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_products_storefront_rank_popular
  ON products (storefront_rank, review_count DESC NULLS LAST, created_at DESC)
  WHERE is_active = true AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_products_storefront_rank_category
  ON products (category_id, storefront_rank, review_count DESC NULLS LAST, created_at DESC)
  WHERE is_active = true AND status = 'active';

-- Show Munchies (Glenand dog chew range) after all other products.
-- Only touches rows still at the default rank so admin edits are never overwritten on re-run.
UPDATE products
   SET storefront_rank = 100
 WHERE name ILIKE '%munchies%'
   AND storefront_rank = 0;
