-- ============================================================================
-- MIGRATION 1130: Warmpawz Pay catalogue require_bill flag
-- ============================================================================
-- Additive. When true, vendor must upload a bill image and admin must verify
-- before settle; line items allowed. Default false keeps existing sellers open.
-- Backfill pet_store_walkin so walk-in settle behavior is unchanged.
-- ============================================================================

ALTER TABLE warmpawz_pay_vendor_catalog
  ADD COLUMN IF NOT EXISTS require_bill BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN warmpawz_pay_vendor_catalog.require_bill IS
  'When true, Warmpawz Pay settle requires bill image + admin verify for this vendor.';

UPDATE warmpawz_pay_vendor_catalog c
SET require_bill = true,
    updated_at = NOW()
FROM vendors v
JOIN roles r ON r.id = v.role_id
WHERE c.vendor_id = v.id
  AND r.name = 'pet_store_walkin'
  AND c.require_bill = false;

CREATE INDEX IF NOT EXISTS idx_wpay_vendor_catalog_require_bill_true
  ON warmpawz_pay_vendor_catalog (vendor_id)
  WHERE require_bill = true;
