-- ============================================================================
-- MIGRATION 602: Add updated_at column to vendor_documents table
-- ============================================================================
-- Purpose: Add updated_at column to vendor_documents table for tracking document updates
-- Date: 2026-01-28
-- Issue: Column "updated_at" of relation "vendor_documents" does not exist
-- ============================================================================

-- Add updated_at column to vendor_documents table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendor_documents' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE vendor_documents ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE 'Added updated_at column to vendor_documents table.';
  ELSE
    RAISE NOTICE 'updated_at column already exists in vendor_documents table.';
  END IF;
END $$;

-- Add comment to document the column
COMMENT ON COLUMN vendor_documents.updated_at IS 'Timestamp when the document was last updated';

-- Create or replace function to update updated_at column (if it doesn't exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at on row updates (if trigger doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_vendor_documents_updated_at'
  ) THEN
    CREATE TRIGGER update_vendor_documents_updated_at
      BEFORE UPDATE ON vendor_documents
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    
    RAISE NOTICE 'Created trigger to automatically update updated_at column.';
  ELSE
    RAISE NOTICE 'Trigger update_vendor_documents_updated_at already exists.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- If trigger creation fails, just log a warning
  RAISE WARNING 'Could not create trigger: %', SQLERRM;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
