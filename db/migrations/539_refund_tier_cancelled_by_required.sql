-- Migration 539: Remove "any" from refund tier cancelled_by; require pet_parent or provider only.
-- UI no longer offers "Not specified / Any"; policy must be for Pet Parent or Service Provider.
-- Safe to run even if migration 537 was not run (adds column if missing).

-- Ensure column exists (from migration 537)
ALTER TABLE vendor_refund_tiers
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT;

-- Backfill: treat NULL or 'any' as pet_parent so all rows are valid before adding constraint
UPDATE vendor_refund_tiers
SET cancelled_by = 'pet_parent'
WHERE cancelled_by IS NULL OR cancelled_by = 'any';

-- Enforce allowed values only
ALTER TABLE vendor_refund_tiers
  DROP CONSTRAINT IF EXISTS chk_vendor_refund_tiers_cancelled_by;

ALTER TABLE vendor_refund_tiers
  ADD CONSTRAINT chk_vendor_refund_tiers_cancelled_by
  CHECK (cancelled_by IN ('pet_parent', 'provider'));

-- Make column required and default for new rows
ALTER TABLE vendor_refund_tiers
  ALTER COLUMN cancelled_by SET NOT NULL;

ALTER TABLE vendor_refund_tiers
  ALTER COLUMN cancelled_by SET DEFAULT 'pet_parent';

COMMENT ON COLUMN vendor_refund_tiers.cancelled_by IS 'Who cancels: pet_parent (customer) or provider (service provider/platform). Required; no "any".';
