-- Migration 1115: First-class lat/lng on customer_addresses.
-- Admin GET /admin/customers/active (savedAddressesByCustomerId) and address
-- writes expect latitude/longitude columns. The table historically only had
-- coordinates JSONB { lat, lng }.

ALTER TABLE customer_addresses
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;

ALTER TABLE customer_addresses
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

COMMENT ON COLUMN customer_addresses.latitude IS 'Saved address latitude (Places / GPS)';
COMMENT ON COLUMN customer_addresses.longitude IS 'Saved address longitude (Places / GPS)';
