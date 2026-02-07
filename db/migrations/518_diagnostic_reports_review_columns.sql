-- ============================================================================
-- MIGRATION 518: Add review columns to diagnostic_reports table
-- ============================================================================
-- Fixes: column "dr.reviewed_by" does not exist
-- Adds reviewed_by, reviewed_at, and review_notes columns for vet review functionality
-- ============================================================================

DO $$
BEGIN
  -- Add reviewed_by if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'diagnostic_reports' 
      AND column_name = 'reviewed_by'
  ) THEN
    ALTER TABLE diagnostic_reports 
      ADD COLUMN reviewed_by UUID REFERENCES vendors(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_diagnostic_reports_reviewed_by 
      ON diagnostic_reports(reviewed_by) 
      WHERE reviewed_by IS NOT NULL;
    
    RAISE NOTICE 'Added reviewed_by column to diagnostic_reports';
  END IF;

  -- Add reviewed_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'diagnostic_reports' 
      AND column_name = 'reviewed_at'
  ) THEN
    ALTER TABLE diagnostic_reports 
      ADD COLUMN reviewed_at TIMESTAMPTZ;
    
    CREATE INDEX IF NOT EXISTS idx_diagnostic_reports_reviewed_at 
      ON diagnostic_reports(reviewed_at) 
      WHERE reviewed_at IS NOT NULL;
    
    RAISE NOTICE 'Added reviewed_at column to diagnostic_reports';
  END IF;

  -- Add review_notes if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'diagnostic_reports' 
      AND column_name = 'review_notes'
  ) THEN
    ALTER TABLE diagnostic_reports 
      ADD COLUMN review_notes TEXT;
    
    RAISE NOTICE 'Added review_notes column to diagnostic_reports';
  END IF;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Migration 518 error: %', SQLERRM;
END $$;
