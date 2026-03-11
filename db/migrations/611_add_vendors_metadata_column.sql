-- ============================================================================
-- MIGRATION 611: Add vendors.metadata column (from inline code changes)
-- Date: 2026-02-28
-- Purpose: Migrate inline ALTER TABLE statements from service-discovery.customer.ts to proper migration
-- ============================================================================
-- This migration adds the metadata column that was being added inline in the code
-- Source: backend/lambda/src/endpoints/customer/customerEndpoint/service-discovery.customer.ts (line 4775)
-- ============================================================================

DO $$
BEGIN
  -- Add metadata column to vendors table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'metadata') THEN
    ALTER TABLE vendors ADD COLUMN metadata JSONB;
    COMMENT ON COLUMN vendors.metadata IS 'Additional metadata for vendors (facility info, etc.)';
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_vendors_metadata ON vendors USING gin(metadata) WHERE metadata IS NOT NULL;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
