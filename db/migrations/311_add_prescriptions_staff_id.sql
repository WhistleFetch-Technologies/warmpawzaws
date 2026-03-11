-- ============================================================================
-- MIGRATION 311: Add staff_id to prescriptions if missing
-- ============================================================================
-- Date: 2026-01-24
-- Purpose: Fix "column staff_id does not exist" when staff upload prescriptions.
--          Some prescriptions tables were created without staff_id.
--
-- Run: psql -h <RDS_HOST> -p 5432 -U <USER> -d <DB> -f db/migrations/311_add_prescriptions_staff_id.sql
-- Or:  node scripts/run-migration-311-prescriptions-staff-id.js dev ap-south-1
-- ============================================================================

-- Add staff_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'prescriptions'
          AND column_name = 'staff_id'
    ) THEN
        ALTER TABLE prescriptions
        ADD COLUMN staff_id UUID REFERENCES staff(id) ON DELETE SET NULL;
        COMMENT ON COLUMN prescriptions.staff_id IS 'Staff member who created the prescription (when uploaded by staff)';
        RAISE NOTICE 'Added staff_id to prescriptions';
    END IF;
END $$;

-- Create index for staff lookups if not exists
CREATE INDEX IF NOT EXISTS idx_prescriptions_staff_id ON prescriptions(staff_id);
