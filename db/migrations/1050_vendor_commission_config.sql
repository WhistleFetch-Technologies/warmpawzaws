-- ============================================================================
-- MIGRATION 1050: Per-vendor commission model configuration (V2 engine)
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_commission_config (
  vendor_id UUID PRIMARY KEY REFERENCES vendors(id),
  commission_model TEXT NOT NULL CHECK (commission_model IN ('category', 'ownership')),
  default_commission_rate NUMERIC(5, 2),
  own_brand_commission_rate NUMERIC(5, 2),
  third_party_commission_rate NUMERIC(5, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_commission_config_model
  ON vendor_commission_config(commission_model);

COMMENT ON TABLE vendor_commission_config IS
  'Ecommerce commission V2: one commission model per vendor (category or ownership)';
