-- Add house / flat and floor on customers (profile). Idempotent for existing DBs.
-- Nullable for legacy rows; new profile submissions validate house no on the API.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS house_no TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS floor TEXT;

COMMENT ON COLUMN customers.house_no IS 'House or flat number from customer profile';
COMMENT ON COLUMN customers.floor IS 'Floor (optional) from customer profile';
