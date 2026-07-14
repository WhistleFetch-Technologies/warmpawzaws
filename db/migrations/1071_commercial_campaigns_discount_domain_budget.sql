-- MIGRATION 1071: Commercial campaigns — durable discount_domain + budget tracking.
-- Renumbered from 1064 — develop owns 1064_ecommerce_order_settlements.sql
-- Campaigns orchestrate promotions/coupons; they do not calculate discounts.

ALTER TABLE commercial_discount_campaigns
  ADD COLUMN IF NOT EXISTS discount_domain TEXT;

ALTER TABLE commercial_discount_campaigns
  ADD COLUMN IF NOT EXISTS surface TEXT;

ALTER TABLE commercial_discount_campaigns
  ADD COLUMN IF NOT EXISTS budget_cap NUMERIC(14, 2);

ALTER TABLE commercial_discount_campaigns
  ADD COLUMN IF NOT EXISTS budget_spent NUMERIC(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE commercial_discount_campaigns
  ADD COLUMN IF NOT EXISTS goal TEXT;

ALTER TABLE commercial_discount_campaigns
  ADD COLUMN IF NOT EXISTS objective TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commercial_campaigns_discount_domain_check'
  ) THEN
    ALTER TABLE commercial_discount_campaigns
      ADD CONSTRAINT commercial_campaigns_discount_domain_check
      CHECK (discount_domain IS NULL OR discount_domain IN ('SERVICE', 'ECOMMERCE'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'commercial_campaigns_surface_check'
  ) THEN
    ALTER TABLE commercial_discount_campaigns
      ADD CONSTRAINT commercial_campaigns_surface_check
      CHECK (surface IS NULL OR surface IN ('marketing', 'ecommerce'));
  END IF;
END $$;

-- Backfill from metadata when present
UPDATE commercial_discount_campaigns
SET discount_domain = UPPER(COALESCE(metadata->>'discount_domain', metadata->>'domain', ''))
WHERE (discount_domain IS NULL OR TRIM(discount_domain) = '')
  AND UPPER(COALESCE(metadata->>'discount_domain', metadata->>'domain', '')) IN ('SERVICE', 'ECOMMERCE', 'PRODUCT');

UPDATE commercial_discount_campaigns
SET discount_domain = 'ECOMMERCE'
WHERE UPPER(COALESCE(discount_domain, '')) IN ('PRODUCT', 'PRODUCTS', 'SHOP');

UPDATE commercial_discount_campaigns
SET surface = CASE
  WHEN discount_domain = 'ECOMMERCE' THEN 'ecommerce'
  WHEN discount_domain = 'SERVICE' THEN 'marketing'
  WHEN LOWER(COALESCE(metadata->>'surface', '')) = 'ecommerce' THEN 'ecommerce'
  ELSE COALESCE(NULLIF(TRIM(surface), ''), 'marketing')
END
WHERE surface IS NULL OR TRIM(surface) = '';

CREATE INDEX IF NOT EXISTS idx_commercial_campaigns_discount_domain
  ON commercial_discount_campaigns (discount_domain);

CREATE INDEX IF NOT EXISTS idx_commercial_campaigns_surface
  ON commercial_discount_campaigns (surface);

-- Soft inactive flag on links (detach / lifecycle without deleting history)
ALTER TABLE commercial_campaign_promotion_links
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
