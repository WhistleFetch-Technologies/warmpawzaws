-- Add house / flat and floor on customers (profile). Idempotent for existing DBs.
-- Nullable for legacy rows; new profile submissions validate house no on the API.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS house_no TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS floor TEXT;

-- Copy from legacy houseno (PostgreSQL stores unquoted houseNo as houseno) when present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'houseno'
  ) THEN
    UPDATE customers
    SET house_no = houseno
    WHERE (house_no IS NULL OR TRIM(COALESCE(house_no, '')) = '')
      AND houseno IS NOT NULL
      AND TRIM(houseno) <> '';
  END IF;
END $$;

COMMENT ON COLUMN customers.house_no IS 'House or flat number from customer profile';
COMMENT ON COLUMN customers.floor IS 'Floor (optional) from customer profile';
