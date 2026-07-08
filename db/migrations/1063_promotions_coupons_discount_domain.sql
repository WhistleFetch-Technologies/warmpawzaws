-- Phase E1: durable commercial domain on platform promotions & coupons.
-- New rows must set discount_domain = SERVICE | ECOMMERCE.
-- Legacy NULL rows use application-level fallback heuristics.

ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS discount_domain TEXT;

ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS discount_domain TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'promotions_discount_domain_check'
  ) THEN
    ALTER TABLE promotions
      ADD CONSTRAINT promotions_discount_domain_check
      CHECK (discount_domain IS NULL OR discount_domain IN ('SERVICE', 'ECOMMERCE'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coupons_discount_domain_check'
  ) THEN
    ALTER TABLE coupons
      ADD CONSTRAINT coupons_discount_domain_check
      CHECK (discount_domain IS NULL OR discount_domain IN ('SERVICE', 'ECOMMERCE'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_promotions_discount_domain
  ON promotions (discount_domain);

CREATE INDEX IF NOT EXISTS idx_coupons_discount_domain
  ON coupons (discount_domain);
