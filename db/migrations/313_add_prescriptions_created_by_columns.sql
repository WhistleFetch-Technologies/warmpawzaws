-- ============================================================================
-- MIGRATION 313: Add created_by and created_by_role columns to prescriptions if missing
-- ============================================================================
-- Date: 2026-01-23
-- Purpose: Fix "column created_by does not exist" when creating prescriptions.
--          Some prescriptions tables were created without created_by columns.
--
-- Run: psql -h <RDS_HOST> -p 5432 -U <USER> -d <DB> -f db/migrations/313_add_prescriptions_created_by_columns.sql
-- Or:  node scripts/run-migration-313-prescriptions-created-by.js dev ap-south-1
-- ============================================================================

-- Temporarily disable triggers that might reference missing columns
DO $$
DECLARE
    trigger_rec RECORD;
BEGIN
    FOR trigger_rec IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'prescriptions'
          AND trigger_schema = 'public'
    LOOP
        EXECUTE format('ALTER TABLE prescriptions DISABLE TRIGGER %I', trigger_rec.trigger_name);
    END LOOP;
END $$;

-- Add created_by column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'prescriptions'
          AND column_name = 'created_by'
    ) THEN
        ALTER TABLE prescriptions
        ADD COLUMN created_by UUID;
        COMMENT ON COLUMN prescriptions.created_by IS 'UUID of the user who created the prescription (vendor or staff)';
        RAISE NOTICE 'Added created_by column to prescriptions';
    ELSE
        RAISE NOTICE 'created_by column already exists in prescriptions table';
    END IF;
END $$;

-- Add created_by_role column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'prescriptions'
          AND column_name = 'created_by_role'
    ) THEN
        ALTER TABLE prescriptions
        ADD COLUMN created_by_role TEXT DEFAULT 'vendor';
        COMMENT ON COLUMN prescriptions.created_by_role IS 'Role of the user who created the prescription (vendor, staff, etc.)';
        RAISE NOTICE 'Added created_by_role column to prescriptions';
    ELSE
        RAISE NOTICE 'created_by_role column already exists in prescriptions table';
    END IF;
END $$;

-- Backfill created_by from vendor_id where possible (if both exist and created_by is null)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'prescriptions' AND column_name = 'created_by'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'prescriptions' AND column_name = 'vendor_id'
    ) THEN
        UPDATE prescriptions p
        SET created_by = p.vendor_id
        WHERE p.created_by IS NULL
          AND p.vendor_id IS NOT NULL;
        
        RAISE NOTICE 'Backfilled created_by from vendor_id where possible';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Backfill skipped or partial: %', SQLERRM;
END $$;

-- Re-enable triggers
DO $$
DECLARE
    trigger_rec RECORD;
BEGIN
    FOR trigger_rec IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'prescriptions'
          AND trigger_schema = 'public'
    LOOP
        EXECUTE format('ALTER TABLE prescriptions ENABLE TRIGGER %I', trigger_rec.trigger_name);
    END LOOP;
END $$;
