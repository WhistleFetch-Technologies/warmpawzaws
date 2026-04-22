-- Migration 1005: Optional geolocation on customers (profile / address autocomplete).
-- POST/PUT /customer/profile writes these when the client sends latitude, longitude, or coordinates.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

COMMENT ON COLUMN customers.latitude IS 'Primary profile address latitude when provided by client (e.g. Places)';
COMMENT ON COLUMN customers.longitude IS 'Primary profile address longitude when provided by client (e.g. Places)';
