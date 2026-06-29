-- Migration: pg_trgm GIN indexes for ILIKE search performance
-- Idempotent, additive only

CREATE INDEX IF NOT EXISTS idx_vendors_business_name_trgm
  ON vendors USING gin (lower(business_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_vendors_owner_name_trgm
  ON vendors USING gin (lower(owner_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_vendor_services_service_name_trgm
  ON vendor_services USING gin (lower(service_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_vendor_services_description_trgm
  ON vendor_services USING gin (lower(COALESCE(custom_description, '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON products USING gin (lower(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_vendors_discoverable
  ON vendors (id)
  WHERE is_active = true AND status IN ('approved', 'activated', 'active');
