-- ============================================================================
-- Migration 1085: Warmpawz Pay merchant pricing (Phase D)
-- ============================================================================
-- Admin-configured commercial terms per merchant for future Quote Engine.
-- Idempotent, additive only.
-- ============================================================================

CREATE TABLE IF NOT EXISTS warmpawz_pay_merchant_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL,
    catalogue_id UUID,
    discount_type TEXT NOT NULL DEFAULT 'percentage',
    discount_value NUMERIC(12, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_until TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'warmpawz_pay_merchant_pricing'::regclass
      AND conname = 'warmpawz_pay_merchant_pricing_discount_type_check'
  ) THEN
    ALTER TABLE warmpawz_pay_merchant_pricing
      ADD CONSTRAINT warmpawz_pay_merchant_pricing_discount_type_check
      CHECK (discount_type IN ('percentage'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'warmpawz_pay_merchant_pricing'::regclass
      AND conname = 'warmpawz_pay_merchant_pricing_status_check'
  ) THEN
    ALTER TABLE warmpawz_pay_merchant_pricing
      ADD CONSTRAINT warmpawz_pay_merchant_pricing_status_check
      CHECK (status IN ('active', 'disabled'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'warmpawz_pay_merchant_pricing'::regclass
      AND conname = 'warmpawz_pay_merchant_pricing_percentage_range_check'
  ) THEN
    ALTER TABLE warmpawz_pay_merchant_pricing
      ADD CONSTRAINT warmpawz_pay_merchant_pricing_percentage_range_check
      CHECK (
        discount_type <> 'percentage'
        OR (discount_value >= 0 AND discount_value <= 100)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'warmpawz_pay_merchant_pricing_vendor_id_fkey'
  ) THEN
    ALTER TABLE warmpawz_pay_merchant_pricing
      ADD CONSTRAINT warmpawz_pay_merchant_pricing_vendor_id_fkey
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'warmpawz_pay_merchant_pricing_catalogue_id_fkey'
  ) THEN
    ALTER TABLE warmpawz_pay_merchant_pricing
      ADD CONSTRAINT warmpawz_pay_merchant_pricing_catalogue_id_fkey
      FOREIGN KEY (catalogue_id) REFERENCES warmpawz_pay_vendor_catalog(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wpay_merchant_pricing_one_active_per_vendor
  ON warmpawz_pay_merchant_pricing(vendor_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_wpay_merchant_pricing_vendor_id
  ON warmpawz_pay_merchant_pricing(vendor_id);

CREATE INDEX IF NOT EXISTS idx_wpay_merchant_pricing_status
  ON warmpawz_pay_merchant_pricing(status);

CREATE INDEX IF NOT EXISTS idx_wpay_merchant_pricing_effective_from
  ON warmpawz_pay_merchant_pricing(effective_from DESC);
