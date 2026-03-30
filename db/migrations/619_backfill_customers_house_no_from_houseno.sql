-- Backfill customers.house_no from legacy PostgreSQL column houseno (unquoted houseNo in older DDL).
-- Safe if 618 already added house_no; idempotent.
-- Run after 618_add_customers_house_no_floor.sql on RDS where profile saves expected house_no.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'house_no'
  ) AND EXISTS (
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
