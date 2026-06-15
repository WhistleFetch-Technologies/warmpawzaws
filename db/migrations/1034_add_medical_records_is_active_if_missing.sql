-- Add is_active to medical_records on environments that predate migration 034 shape (e.g. prod).
ALTER TABLE medical_records
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_medical_records_is_active ON medical_records (is_active)
  WHERE is_active = true;

COMMENT ON COLUMN medical_records.is_active IS 'Soft-delete flag; default true for customer/vendor uploads and clinical records';
