-- ============================================================================
-- Migration 310: Add Prescription Date Fields to Medical Records
-- Date: 2026-01-21
-- Purpose: Add record_date (mandatory for handwritten prescriptions) and 
--          prescription_date (auto-updated for doctor-created prescriptions)
-- ============================================================================

BEGIN;

-- Add record_date column (for handwritten prescriptions - mandatory)
ALTER TABLE medical_records 
ADD COLUMN IF NOT EXISTS record_date DATE;

-- Add prescription_date column (for doctor-created prescriptions - auto-updates)
ALTER TABLE medical_records 
ADD COLUMN IF NOT EXISTS prescription_date TIMESTAMP WITH TIME ZONE;

-- Add index for faster queries by date
CREATE INDEX IF NOT EXISTS idx_medical_records_record_date ON medical_records(record_date DESC);
CREATE INDEX IF NOT EXISTS idx_medical_records_prescription_date ON medical_records(prescription_date DESC);

-- Add comment for documentation
COMMENT ON COLUMN medical_records.record_date IS 'Date field (mandatory) for handwritten prescriptions uploaded by customer/vendor';
COMMENT ON COLUMN medical_records.prescription_date IS 'Auto-updated timestamp for doctor-created prescriptions - latest date comes first';

COMMIT;
