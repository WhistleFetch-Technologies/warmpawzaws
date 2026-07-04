-- ============================================================================
-- MIGRATION 1053: Product listing ownership for ownership commission model
-- ============================================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS listing_ownership TEXT
    CHECK (listing_ownership IN ('own_brand', 'third_party')),
  ADD COLUMN IF NOT EXISTS listing_ownership_source TEXT
    CHECK (listing_ownership_source IN ('auto', 'manual', 'admin')),
  ADD COLUMN IF NOT EXISTS registered_brand_id UUID
    REFERENCES vendor_registered_brands(id);

CREATE INDEX IF NOT EXISTS idx_products_listing_ownership
  ON products(vendor_id, listing_ownership)
  WHERE listing_ownership IS NOT NULL;

COMMENT ON COLUMN products.listing_ownership IS
  'Resolved ownership: own_brand or third_party (ownership commission model)';
COMMENT ON COLUMN products.listing_ownership_source IS
  'How listing_ownership was set: auto, manual, or admin';
