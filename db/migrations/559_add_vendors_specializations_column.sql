-- ============================================================================
-- MIGRATION 559: Add specializations Column to Vendors Table
-- ============================================================================
-- Date: 2026-01-27
-- Purpose: Add specializations JSONB column to vendors table for production
--          This column is required by the API endpoint /vendor/facility/:vendorId
--          Error: column "specializations" of relation "vendors" does not exist
-- ============================================================================

-- Add specializations JSONB column to vendors (for faster access without joining)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vendors' AND column_name = 'specializations'
    ) THEN
        ALTER TABLE vendors ADD COLUMN specializations JSONB DEFAULT '[]'::jsonb;
        COMMENT ON COLUMN vendors.specializations IS 'Array of specialization strings for the vendor. Used by service discovery and vendor profile endpoints.';
    END IF;
END $$;

-- Create GIN index for efficient querying of specializations array
CREATE INDEX IF NOT EXISTS idx_vendors_specializations ON vendors USING GIN (specializations);

-- ============================================================================
-- END OF MIGRATION 559
-- ============================================================================
