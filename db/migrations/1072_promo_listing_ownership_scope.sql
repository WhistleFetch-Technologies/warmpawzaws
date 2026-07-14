-- ============================================================================
-- MIGRATION 1072: Promo targeting by product listing ownership
-- ============================================================================
-- Allows admin + vendor ecommerce promotions to scope discounts to
-- own_brand products, third_party products, or both (default).
-- Mirrors products.listing_ownership from migration 1053.
-- ============================================================================

ALTER TABLE vendor_promotions
  ADD COLUMN IF NOT EXISTS listing_ownership_scope TEXT
    NOT NULL DEFAULT 'all'
    CHECK (listing_ownership_scope IN ('all', 'own_brand', 'third_party'));

ALTER TABLE ecommerce_admin_promotions
  ADD COLUMN IF NOT EXISTS listing_ownership_scope TEXT
    NOT NULL DEFAULT 'all'
    CHECK (listing_ownership_scope IN ('all', 'own_brand', 'third_party'));

COMMENT ON COLUMN vendor_promotions.listing_ownership_scope IS
  'Product ownership filter: all | own_brand | third_party (products.listing_ownership)';
COMMENT ON COLUMN ecommerce_admin_promotions.listing_ownership_scope IS
  'Product ownership filter: all | own_brand | third_party (products.listing_ownership)';
