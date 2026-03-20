-- ============================================================================
-- MIGRATION 605: Add availability_configured column to vendors table
-- ============================================================================
-- Date: 2026-02-24
-- Purpose: Add availability_configured column to track vendor availability setup completion
-- ============================================================================

-- Add availability_configured column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'availability_configured'
  ) THEN
    ALTER TABLE vendors ADD COLUMN availability_configured BOOLEAN DEFAULT false;
    COMMENT ON COLUMN vendors.availability_configured IS 'Tracks whether vendor has completed availability/schedule setup';
  END IF;
END $$;

-- Also ensure services_configured column exists (for consistency)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'services_configured'
  ) THEN
    ALTER TABLE vendors ADD COLUMN services_configured BOOLEAN DEFAULT false;
    COMMENT ON COLUMN vendors.services_configured IS 'Tracks whether vendor has completed services setup';
  END IF;
END $$;

-- Create index on availability_configured for faster queries
CREATE INDEX IF NOT EXISTS idx_vendors_availability_configured ON vendors(availability_configured) 
  WHERE availability_configured = false;

-- Create composite index for common query pattern: approved but availability not configured
CREATE INDEX IF NOT EXISTS idx_vendors_approved_not_availability ON vendors(status, availability_configured) 
  WHERE status = 'approved' AND availability_configured = false;

COMMENT ON TABLE vendors IS 'Vendor profiles - includes availability_configured flag for tracking availability setup completion';
