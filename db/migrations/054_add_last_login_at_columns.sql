-- ============================================================================
-- MIGRATION 054: Add last_login_at columns to vendors and admins tables
-- ============================================================================
-- Date: 2026-01-12
-- Purpose: Add last_login_at tracking for vendors and admins to support
--          state persistence and login tracking in UAT mode
-- ============================================================================

-- Add last_login_at to vendors table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'last_login_at'
  ) THEN
    ALTER TABLE vendors ADD COLUMN last_login_at TIMESTAMPTZ;
    COMMENT ON COLUMN vendors.last_login_at IS 'Timestamp of last successful login - used for state persistence and activity tracking';
    RAISE NOTICE 'Added last_login_at column to vendors table';
  ELSE
    RAISE NOTICE 'last_login_at column already exists in vendors table';
  END IF;
END $$;

-- Add last_login_at to admins table if it doesn't exist (only if table exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'admins'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'admins' AND column_name = 'last_login_at'
    ) THEN
      ALTER TABLE admins ADD COLUMN last_login_at TIMESTAMPTZ;
      COMMENT ON COLUMN admins.last_login_at IS 'Timestamp of last successful login - used for state persistence and activity tracking';
      RAISE NOTICE 'Added last_login_at column to admins table';
    ELSE
      RAISE NOTICE 'last_login_at column already exists in admins table';
    END IF;
  ELSE
    RAISE NOTICE 'admins table does not exist - skipping last_login_at column addition';
  END IF;
END $$;

-- Create indexes for faster queries on last_login_at
CREATE INDEX IF NOT EXISTS idx_vendors_last_login_at ON vendors(last_login_at DESC) WHERE last_login_at IS NOT NULL;

COMMENT ON INDEX idx_vendors_last_login_at IS 'Index for querying vendors by last login time';

-- Create index for admins table only if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'admins'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_admins_last_login_at ON admins(last_login_at DESC) WHERE last_login_at IS NOT NULL;
    COMMENT ON INDEX idx_admins_last_login_at IS 'Index for querying admins by last login time';
  END IF;
END $$;
