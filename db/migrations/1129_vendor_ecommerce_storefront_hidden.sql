-- ============================================================================
-- MIGRATION 1129: Vendor ecommerce storefront hide/publish flag
-- ============================================================================
-- Additive. Does not change products, categories, or product_category_links.
-- When true, public shop queries skip this vendor's products. Publish sets
-- the flag false so existing categorization lists them again as-is.
-- ============================================================================

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS ecommerce_storefront_hidden BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN vendors.ecommerce_storefront_hidden IS
  'When true, hide all of this vendor''s products from the public ecommerce storefront without changing product or category rows.';

CREATE INDEX IF NOT EXISTS idx_vendors_ecommerce_storefront_hidden_true
  ON vendors (id)
  WHERE ecommerce_storefront_hidden = true;
