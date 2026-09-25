-- ============================================================================
-- Migration 1117: Warmpawz Appointments dual fee (centre + home)
-- ============================================================================
-- appointment_fee remains the centre / default fee.
-- appointment_fee_home is the at_home booking fee (backfilled from centre).
-- Idempotent, additive only.
-- ============================================================================

ALTER TABLE warmpawz_appointments_vendor_catalog
  ADD COLUMN IF NOT EXISTS appointment_fee_home NUMERIC(12, 2);

UPDATE warmpawz_appointments_vendor_catalog
SET appointment_fee_home = appointment_fee
WHERE appointment_fee_home IS NULL;

ALTER TABLE warmpawz_appointments_vendor_catalog
  ALTER COLUMN appointment_fee_home SET DEFAULT 0;

UPDATE warmpawz_appointments_vendor_catalog
SET appointment_fee_home = 0
WHERE appointment_fee_home IS NULL;

-- Idempotent CHECK: skip if already present (DO $$ is unreliable on RDS Data API).
ALTER TABLE warmpawz_appointments_vendor_catalog
  DROP CONSTRAINT IF EXISTS wappt_catalog_fee_home_nonneg_chk;

ALTER TABLE warmpawz_appointments_vendor_catalog
  ADD CONSTRAINT wappt_catalog_fee_home_nonneg_chk
  CHECK (appointment_fee_home >= 0);

COMMENT ON COLUMN warmpawz_appointments_vendor_catalog.appointment_fee IS
  'Centre (at_center) appointment booking fee (INR). Default/legacy fee.';

COMMENT ON COLUMN warmpawz_appointments_vendor_catalog.appointment_fee_home IS
  'Home (at_home) appointment booking fee (INR). Falls back to appointment_fee when unset historically.';
