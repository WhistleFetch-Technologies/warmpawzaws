-- ============================================================================
-- MIGRATION 030: Add setup_completed column to vendors table
-- ============================================================================
-- Date: 2024-12-24
-- Purpose: Add setup_completed column to track vendor setup completion status
-- ============================================================================

-- Add setup_completed column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'setup_completed'
  ) THEN
    ALTER TABLE vendors ADD COLUMN setup_completed BOOLEAN DEFAULT false;
    COMMENT ON COLUMN vendors.setup_completed IS 'Tracks whether vendor has completed initial setup (services, availability, etc.)';
  END IF;
END $$;

-- Ensure is_active column exists (should already exist, but verify)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE vendors ADD COLUMN is_active BOOLEAN DEFAULT false;
    COMMENT ON COLUMN vendors.is_active IS 'Whether vendor is active and can receive bookings';
  END IF;
END $$;

-- Ensure status column has NOT NULL constraint and default
DO $$ 
BEGIN
  -- Check if status column exists and doesn't have NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' 
    AND column_name = 'status' 
    AND is_nullable = 'YES'
  ) THEN
    -- First set default for any NULL values
    UPDATE vendors SET status = 'pending' WHERE status IS NULL;
    
    -- Then add NOT NULL constraint
    ALTER TABLE vendors ALTER COLUMN status SET NOT NULL;
    ALTER TABLE vendors ALTER COLUMN status SET DEFAULT 'pending';
  END IF;
END $$;

-- Create index on setup_completed for faster queries
CREATE INDEX IF NOT EXISTS idx_vendors_setup_completed ON vendors(setup_completed) WHERE setup_completed = false;

-- Create composite index for common query pattern: approved but not setup complete
CREATE INDEX IF NOT EXISTS idx_vendors_approved_not_setup ON vendors(status, setup_completed) 
  WHERE status = 'approved' AND setup_completed = false;

COMMENT ON TABLE vendors IS 'Vendor profiles - includes setup_completed flag for tracking onboarding completion';

