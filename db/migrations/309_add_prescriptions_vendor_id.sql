-- ============================================================================
-- MIGRATION 309: Add vendor_id to prescriptions if missing
-- ============================================================================
-- Date: 2026-01-20
-- Purpose: Fix "column vendor_id does not exist" when creating prescriptions.
--          Some prescriptions tables were created without vendor_id.
--
-- Run: psql -h <RDS_HOST> -p 5432 -U <USER> -d <DB> -f db/migrations/309_add_prescriptions_vendor_id.sql
-- Or:  ./scripts/run-migration-rds.sh (edit MIGRATION_FILE to point to this file)
-- ============================================================================

-- Add vendor_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'prescriptions'
          AND column_name = 'vendor_id'
    ) THEN
        ALTER TABLE prescriptions
        ADD COLUMN vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE;
        COMMENT ON COLUMN prescriptions.vendor_id IS 'Vendor who issued the prescription';
        RAISE NOTICE 'Added vendor_id to prescriptions';
    END IF;
END $$;

-- Create index for vendor lookups if not exists
CREATE INDEX IF NOT EXISTS idx_prescriptions_vendor_id ON prescriptions(vendor_id);

-- Backfill vendor_id from created_by where possible (if both exist and vendor_id is null)
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
        SET vendor_id = p.created_by::uuid
        WHERE p.vendor_id IS NULL
          AND p.created_by IS NOT NULL
          AND EXISTS (SELECT 1 FROM vendors v WHERE v.id = p.created_by::uuid);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Backfill skipped or partial: %', SQLERRM;
END $$;
