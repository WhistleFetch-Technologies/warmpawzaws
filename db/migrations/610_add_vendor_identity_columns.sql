-- ============================================================================
-- MIGRATION 610: Add vendor_identity columns (from inline code changes)
-- Date: 2026-02-28
-- Purpose: Migrate inline ALTER TABLE statements from staff.ts to proper migration
-- ============================================================================
-- This migration adds columns that were being added inline in the code
-- Source: backend/lambda/src/endpoints/staff.ts (lines 840, 851)
-- ============================================================================

DO $$
BEGIN
  -- Add user_type column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_identity' AND column_name = 'user_type') THEN
    ALTER TABLE vendor_identity ADD COLUMN user_type VARCHAR(20) DEFAULT 'vendor';
    COMMENT ON COLUMN vendor_identity.user_type IS 'Type of user: vendor, staff, individual_provider, etc.';
  END IF;

  -- Add metadata column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_identity' AND column_name = 'metadata') THEN
    ALTER TABLE vendor_identity ADD COLUMN metadata JSONB DEFAULT '{}';
    COMMENT ON COLUMN vendor_identity.metadata IS 'Additional metadata for vendor identity';
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vendor_identity_user_type ON vendor_identity(user_type) WHERE user_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendor_identity_metadata ON vendor_identity USING gin(metadata) WHERE metadata IS NOT NULL AND metadata != '{}'::jsonb;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
