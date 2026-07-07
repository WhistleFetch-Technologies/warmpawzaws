-- Platform coupons: optional service/booking targeting (Marketing Promotion Center).
ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS applicable_to TEXT,
  ADD COLUMN IF NOT EXISTS service_category TEXT,
  ADD COLUMN IF NOT EXISTS applicable_services JSONB,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

COMMENT ON COLUMN coupons.applicable_to IS 'all | bookings | products | services';
COMMENT ON COLUMN coupons.service_category IS 'Primary admin catalogue category slug e.g. veterinary';
COMMENT ON COLUMN coupons.applicable_services IS 'Customer service buckets and admin slugs for eligibility';
