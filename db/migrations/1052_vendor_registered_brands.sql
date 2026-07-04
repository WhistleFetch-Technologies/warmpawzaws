-- ============================================================================
-- MIGRATION 1052: Vendor brand registry for ownership-based commission
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_registered_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  brand_name TEXT NOT NULL,
  brand_name_normalized TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (vendor_id, brand_name_normalized)
);

CREATE INDEX IF NOT EXISTS idx_vendor_registered_brands_vendor
  ON vendor_registered_brands(vendor_id);

CREATE INDEX IF NOT EXISTS idx_vendor_registered_brands_normalized
  ON vendor_registered_brands(vendor_id, brand_name_normalized)
  WHERE status = 'active';

COMMENT ON TABLE vendor_registered_brands IS
  'Vendor-owned brand names for auto-detecting own_brand vs third_party listings';
