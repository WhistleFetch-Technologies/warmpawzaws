-- ============================================================================
-- MIGRATION 1051: Product-level commission overrides (highest priority)
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_commission_overrides (
  product_id UUID PRIMARY KEY REFERENCES products(id),
  commission_rate NUMERIC(5, 2) NOT NULL,
  reason TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_commission_overrides_active
  ON product_commission_overrides(product_id)
  WHERE is_active = true;

COMMENT ON TABLE product_commission_overrides IS
  'Highest-priority ecommerce commission override per product';
