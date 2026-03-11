-- ============================================================================
-- Migration: 214_add_vendor_upi_columns.sql
-- Description: Add UPI ID and verification columns to vendors table
-- Date: 2026-01-21
-- Issue: UPI verification failing with "column upi_id does not exist" error
-- ============================================================================

-- Add UPI ID column for vendor payment settings
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vendors' AND column_name = 'upi_id'
    ) THEN
        ALTER TABLE vendors ADD COLUMN upi_id TEXT;
        RAISE NOTICE 'Added upi_id column to vendors table';
    ELSE
        RAISE NOTICE 'Column upi_id already exists in vendors table';
    END IF;
END $$;

-- Add UPI verified status column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vendors' AND column_name = 'upi_verified'
    ) THEN
        ALTER TABLE vendors ADD COLUMN upi_verified BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added upi_verified column to vendors table';
    ELSE
        RAISE NOTICE 'Column upi_verified already exists in vendors table';
    END IF;
END $$;

-- Add UPI verified timestamp column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vendors' AND column_name = 'upi_verified_at'
    ) THEN
        ALTER TABLE vendors ADD COLUMN upi_verified_at TIMESTAMPTZ;
        RAISE NOTICE 'Added upi_verified_at column to vendors table';
    ELSE
        RAISE NOTICE 'Column upi_verified_at already exists in vendors table';
    END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN vendors.upi_id IS 'UPI ID for vendor payments (e.g., vendor@upi)';
COMMENT ON COLUMN vendors.upi_verified IS 'Whether the UPI ID has been verified';
COMMENT ON COLUMN vendors.upi_verified_at IS 'Timestamp when UPI ID was verified';

-- Create index for UPI lookups (if needed)
CREATE INDEX IF NOT EXISTS idx_vendors_upi_id ON vendors(upi_id) WHERE upi_id IS NOT NULL;

-- ============================================================================
-- VERIFICATION QUERY (run after migration to confirm)
-- ============================================================================
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'vendors' AND column_name IN ('upi_id', 'upi_verified', 'upi_verified_at');
