-- ============================================================================
-- MIGRATION 517: Update report_type constraint in diagnostic_reports
-- ============================================================================
-- Fixes: violates check constraint "diagnostic_reports_report_type_check"
-- The constraint might only allow ('pdf', 'image', 'document') from 008 schema,
-- but we need to support ('blood_test', 'urine_test', 'stool_test', 'imaging', 'biopsy', 'other') from 007 schema.
-- This migration updates the constraint to allow all possible values.
-- ============================================================================

DO $$
BEGIN
  -- Check if report_type column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'diagnostic_reports' 
      AND column_name = 'report_type'
  ) THEN
    -- Drop the existing constraint if it exists
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_schema = 'public' 
        AND table_name = 'diagnostic_reports' 
        AND constraint_name = 'diagnostic_reports_report_type_check'
    ) THEN
      ALTER TABLE diagnostic_reports 
        DROP CONSTRAINT diagnostic_reports_report_type_check;
      
      RAISE NOTICE 'Dropped existing diagnostic_reports_report_type_check constraint';
    END IF;
    
    -- Add new constraint that allows all possible values
    ALTER TABLE diagnostic_reports 
      ADD CONSTRAINT diagnostic_reports_report_type_check 
      CHECK (report_type IS NULL OR report_type IN (
        -- File format types (from 008 schema)
        'pdf', 'image', 'document',
        -- Test type categories (from 007 schema)
        'blood_test', 'urine_test', 'stool_test', 'imaging', 'biopsy', 'other',
        -- Additional common values
        'lab', 'pathology'
      ));
    
    RAISE NOTICE 'Added updated diagnostic_reports_report_type_check constraint with all allowed values';
  END IF;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Migration 517 error: %', SQLERRM;
END $$;
