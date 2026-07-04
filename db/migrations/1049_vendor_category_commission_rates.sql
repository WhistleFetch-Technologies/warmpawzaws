-- ============================================================================
-- MIGRATION 1049: Vendor + category commission overrides (enterprise matrix)
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_category_commission_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  category_id UUID NOT NULL REFERENCES ecommerce_categories(id),
  commission_rate NUMERIC(5, 2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendor_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_category_commission_vendor
  ON vendor_category_commission_rates(vendor_id);

CREATE INDEX IF NOT EXISTS idx_vendor_category_commission_category
  ON vendor_category_commission_rates(category_id);

COMMENT ON TABLE vendor_category_commission_rates IS
  'Enterprise commission overrides: per-vendor rate for a specific ecommerce category';
