-- ============================================================================
-- MIGRATION 631: Add created_by / created_by_role to medical_records if missing
-- ============================================================================
-- Date: 2026-03-31
-- Purpose: Fix "column created_by_role of relation medical_records does not exist"
--          when inserting health records (e.g. upload-prescription). Some RDS
--          databases were created from migrations that omitted these columns.
--
-- Run: psql -h <RDS_HOST> -p 5432 -U <USER> -d <DB> -f db/migrations/631_add_medical_records_created_by_columns.sql
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'medical_records'
          AND column_name = 'created_by'
    ) THEN
        ALTER TABLE medical_records ADD COLUMN created_by UUID;
        COMMENT ON COLUMN medical_records.created_by IS 'UUID of creator (vendor, staff, or system user when applicable)';
        RAISE NOTICE 'Added created_by column to medical_records';
    ELSE
        RAISE NOTICE 'created_by already exists on medical_records';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'medical_records'
          AND column_name = 'created_by_role'
    ) THEN
        ALTER TABLE medical_records
        ADD COLUMN created_by_role TEXT DEFAULT 'vendor';
        COMMENT ON COLUMN medical_records.created_by_role IS 'Role of creator: customer, vendor, staff, admin, system';
        RAISE NOTICE 'Added created_by_role column to medical_records';
    ELSE
        RAISE NOTICE 'created_by_role already exists on medical_records';
    END IF;
END $$;
