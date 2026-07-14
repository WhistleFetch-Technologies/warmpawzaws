-- Admin coupon wizard + PUT /admin/coupons/:id persist max discount cap.
ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS max_discount_amount NUMERIC(10, 2);

-- Backfill from legacy column name when present (migration 013 used max_discount).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'coupons' AND column_name = 'max_discount'
  ) THEN
    UPDATE coupons
    SET max_discount_amount = max_discount
    WHERE max_discount_amount IS NULL AND max_discount IS NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN coupons.max_discount_amount IS 'Maximum discount cap for percentage-type coupons';
