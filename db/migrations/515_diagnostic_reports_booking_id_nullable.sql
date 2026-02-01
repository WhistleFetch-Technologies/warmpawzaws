-- ============================================================================
-- MIGRATION 515: Make diagnostic_booking_id nullable in diagnostic_reports
-- ============================================================================
-- Fixes: null value in column "diagnostic_booking_id" violates not-null constraint
-- The table might have diagnostic_booking_id as NOT NULL (from 008 schema),
-- but we're using booking_id from bookings table instead.
-- This migration makes diagnostic_booking_id nullable if booking_id exists.
-- ============================================================================

DO $$
BEGIN
  -- Check if diagnostic_booking_id exists and is NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'diagnostic_reports' 
      AND column_name = 'diagnostic_booking_id'
      AND is_nullable = 'NO'
  ) THEN
    -- Check if booking_id also exists (our preferred column)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'diagnostic_reports' 
        AND column_name = 'booking_id'
    ) THEN
      -- Make diagnostic_booking_id nullable since we're using booking_id
      ALTER TABLE diagnostic_reports 
        ALTER COLUMN diagnostic_booking_id DROP NOT NULL;
      
      RAISE NOTICE 'Made diagnostic_booking_id nullable in diagnostic_reports (booking_id is available)';
    ELSE
      -- booking_id doesn't exist, but we still want to make diagnostic_booking_id nullable
      -- This allows the table to work with both schemas
      ALTER TABLE diagnostic_reports 
        ALTER COLUMN diagnostic_booking_id DROP NOT NULL;
      
      RAISE NOTICE 'Made diagnostic_booking_id nullable in diagnostic_reports';
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Migration 515 error: %', SQLERRM;
END $$;
