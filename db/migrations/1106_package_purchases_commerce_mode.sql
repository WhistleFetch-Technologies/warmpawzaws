-- ============================================================================
-- 1106: Stamp package purchase commerce context (Marketplace vs Warmpawz Pay)
-- ============================================================================
-- Additive only. Existing Marketplace rows stay NULL / default marketplace.
-- Settlement reads this (when present) plus bookings.commerce_mode.
-- DO NOT apply automatically — create only.

BEGIN;

ALTER TABLE package_purchases
  ADD COLUMN IF NOT EXISTS commerce_mode TEXT;

ALTER TABLE package_purchases
  ADD COLUMN IF NOT EXISTS commission_source TEXT;

UPDATE package_purchases
SET commerce_mode = 'marketplace'
WHERE commerce_mode IS NULL;

ALTER TABLE package_purchases
  ALTER COLUMN commerce_mode SET DEFAULT 'marketplace';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'package_purchases_commerce_mode_check'
  ) THEN
    ALTER TABLE package_purchases
      ADD CONSTRAINT package_purchases_commerce_mode_check
      CHECK (commerce_mode IN ('marketplace', 'warmpawz_pay'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_package_purchases_commerce_mode
  ON package_purchases (commerce_mode);

COMMENT ON COLUMN package_purchases.commerce_mode IS
  'Purchase commerce context. marketplace = Marketplace commission; warmpawz_pay = Pay publication tier.';

COMMENT ON COLUMN package_purchases.commission_source IS
  'Optional lineage label: marketplace_tier | wpay_publication_tier.';

COMMIT;
