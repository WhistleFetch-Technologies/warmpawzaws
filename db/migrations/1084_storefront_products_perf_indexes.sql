-- ============================================================================
-- MIGRATION 1084: Storefront product list performance indexes
-- Supports GET /ecommerce/products default sort (popular) and category PLP.
-- Partial indexes align with storefront active + approved products only.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_products_storefront_popular
  ON products (review_count DESC NULLS LAST, created_at DESC)
  WHERE is_active = true AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_products_storefront_category
  ON products (category_id, review_count DESC NULLS LAST, created_at DESC)
  WHERE is_active = true AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_products_storefront_featured
  ON products (created_at DESC)
  WHERE is_active = true AND status = 'active' AND COALESCE(is_featured, false) = true;

CREATE INDEX IF NOT EXISTS idx_ecommerce_categories_active_id
  ON ecommerce_categories (id)
  WHERE is_active = true;
