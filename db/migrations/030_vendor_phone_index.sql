-- ============================================================================
-- MIGRATION 030: Vendor Phone Index
-- ============================================================================
-- Date: 2024-12-23
-- Purpose: Create index on vendors.phone for fast phone lookups
-- Migration: KV to SQL - Auth & Vendor Indexing
-- ============================================================================

-- Create index on vendors.phone for fast phone lookups (replaces vendor:phone: KV keys)
CREATE INDEX IF NOT EXISTS idx_vendors_phone ON vendors(phone) WHERE phone IS NOT NULL;

-- Create unique index to ensure phone uniqueness (if not already exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_vendors_phone_unique' 
        AND tablename = 'vendors'
    ) THEN
        -- Note: Only create unique index if phone uniqueness is desired
        -- Uncomment below if phone should be unique per vendor
        -- CREATE UNIQUE INDEX idx_vendors_phone_unique ON vendors(phone) WHERE phone IS NOT NULL;
    END IF;
END $$;

COMMENT ON INDEX idx_vendors_phone IS 'Fast phone lookup index - replaces vendor:phone: KV keys';

