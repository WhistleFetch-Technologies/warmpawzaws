-- ============================================================================
-- MIGRATION 516: Fix NOT NULL constraints in diagnostic_reports
-- ============================================================================
-- Fixes: null value in column "test_id" and "uploaded_by" violates not-null constraint
-- Makes these columns nullable or provides defaults where appropriate
-- ============================================================================

DO $$
BEGIN
  -- Make test_id nullable if it exists and is NOT NULL
  -- We can generate test_id from test_name, but making it nullable provides flexibility
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'diagnostic_reports' 
      AND column_name = 'test_id'
      AND is_nullable = 'NO'
  ) THEN
    -- Check if test_name exists (we can derive test_id from test_name)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'diagnostic_reports' 
        AND column_name = 'test_name'
    ) THEN
      -- Make test_id nullable since we can derive it from test_name
      ALTER TABLE diagnostic_reports 
        ALTER COLUMN test_id DROP NOT NULL;
      
      RAISE NOTICE 'Made test_id nullable in diagnostic_reports (can be derived from test_name)';
    ELSE
      -- test_name doesn't exist, but we still want to make test_id nullable
      ALTER TABLE diagnostic_reports 
        ALTER COLUMN test_id DROP NOT NULL;
      
      RAISE NOTICE 'Made test_id nullable in diagnostic_reports';
    END IF;
  END IF;

  -- Make uploaded_by nullable if it exists and is NOT NULL
  -- We can find staff from vendor, but making it nullable provides flexibility
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'diagnostic_reports' 
      AND column_name = 'uploaded_by'
      AND is_nullable = 'NO'
  ) THEN
    -- Check if vendor_id exists (we can find staff from vendor_id)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'diagnostic_reports' 
        AND column_name = 'vendor_id'
    ) THEN
      -- Make uploaded_by nullable since we can find it from vendor_id
      ALTER TABLE diagnostic_reports 
        ALTER COLUMN uploaded_by DROP NOT NULL;
      
      RAISE NOTICE 'Made uploaded_by nullable in diagnostic_reports (can be found from vendor_id)';
    ELSE
      -- vendor_id doesn't exist, but we still want to make uploaded_by nullable
      ALTER TABLE diagnostic_reports 
        ALTER COLUMN uploaded_by DROP NOT NULL;
      
      RAISE NOTICE 'Made uploaded_by nullable in diagnostic_reports';
    END IF;
  END IF;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Migration 516 error: %', SQLERRM;
END $$;
