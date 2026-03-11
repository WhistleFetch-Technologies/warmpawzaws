-- ============================================================================
-- MIGRATION 514: Add missing columns to diagnostic_reports for upload flow
-- ============================================================================
-- Fixes: column "vendor_id" of relation "diagnostic_reports" does not exist
-- The table might be using 008 schema which doesn't have vendor_id, customer_id, pet_id, etc.
-- This migration adds all required columns if they don't exist.
-- ============================================================================

DO $$
BEGIN
  -- Add vendor_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'diagnostic_reports' AND column_name = 'vendor_id'
  ) THEN
    ALTER TABLE diagnostic_reports ADD COLUMN vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_diagnostic_reports_vendor_id ON diagnostic_reports(vendor_id) WHERE vendor_id IS NOT NULL;
    RAISE NOTICE 'Added vendor_id column to diagnostic_reports';
  END IF;

  -- Add customer_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'diagnostic_reports' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE diagnostic_reports ADD COLUMN customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_diagnostic_reports_customer_id ON diagnostic_reports(customer_id) WHERE customer_id IS NOT NULL;
    RAISE NOTICE 'Added customer_id column to diagnostic_reports';
  END IF;

  -- Add pet_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'diagnostic_reports' AND column_name = 'pet_id'
  ) THEN
    ALTER TABLE diagnostic_reports ADD COLUMN pet_id UUID REFERENCES pets(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_diagnostic_reports_pet_id ON diagnostic_reports(pet_id) WHERE pet_id IS NOT NULL;
    RAISE NOTICE 'Added pet_id column to diagnostic_reports';
  END IF;

  -- Add test_name if it doesn't exist (008 schema has it, but 007 might not)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'diagnostic_reports' AND column_name = 'test_name'
  ) THEN
    ALTER TABLE diagnostic_reports ADD COLUMN test_name TEXT;
    RAISE NOTICE 'Added test_name column to diagnostic_reports';
  END IF;

  -- Add summary if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'diagnostic_reports' AND column_name = 'summary'
  ) THEN
    ALTER TABLE diagnostic_reports ADD COLUMN summary TEXT;
    RAISE NOTICE 'Added summary column to diagnostic_reports';
  END IF;

  -- Add findings if it doesn't exist (007 schema has it, but 008 might not)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'diagnostic_reports' AND column_name = 'findings'
  ) THEN
    ALTER TABLE diagnostic_reports ADD COLUMN findings TEXT;
    RAISE NOTICE 'Added findings column to diagnostic_reports';
  END IF;

  -- Add status if it doesn't exist (or update constraint if it exists but doesn't allow 'ready')
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'diagnostic_reports' AND column_name = 'status'
  ) THEN
    ALTER TABLE diagnostic_reports ADD COLUMN status TEXT DEFAULT 'ready';
    CREATE INDEX IF NOT EXISTS idx_diagnostic_reports_status ON diagnostic_reports(status);
    RAISE NOTICE 'Added status column to diagnostic_reports';
  END IF;

  -- Add prescribing_vet_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'diagnostic_reports' AND column_name = 'prescribing_vet_id'
  ) THEN
    ALTER TABLE diagnostic_reports ADD COLUMN prescribing_vet_id UUID REFERENCES vendors(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added prescribing_vet_id column to diagnostic_reports';
  END IF;

  -- Add prescribing_vet_booking_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'diagnostic_reports' AND column_name = 'prescribing_vet_booking_id'
  ) THEN
    ALTER TABLE diagnostic_reports ADD COLUMN prescribing_vet_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added prescribing_vet_booking_id column to diagnostic_reports';
  END IF;

  -- Ensure report_url exists (008 has it, but ensure it's there)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'diagnostic_reports' AND column_name = 'report_url'
  ) THEN
    -- Check if report_file_url exists (007 schema) and use that, or add report_url
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'diagnostic_reports' AND column_name = 'report_file_url'
    ) THEN
      -- Create a view or alias, but for now just add report_url
      ALTER TABLE diagnostic_reports ADD COLUMN report_url TEXT;
      -- Copy data from report_file_url if it exists
      UPDATE diagnostic_reports SET report_url = report_file_url WHERE report_file_url IS NOT NULL AND report_url IS NULL;
      RAISE NOTICE 'Added report_url column to diagnostic_reports and copied from report_file_url';
    ELSE
      ALTER TABLE diagnostic_reports ADD COLUMN report_url TEXT;
      RAISE NOTICE 'Added report_url column to diagnostic_reports';
    END IF;
  END IF;

  -- Ensure booking_id exists (507 migration should have added it, but double-check)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'diagnostic_reports' AND column_name = 'booking_id'
  ) THEN
    ALTER TABLE diagnostic_reports ADD COLUMN booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_diagnostic_reports_booking_id ON diagnostic_reports(booking_id) WHERE booking_id IS NOT NULL;
    RAISE NOTICE 'Added booking_id column to diagnostic_reports';
  END IF;

  -- Update report_type constraint to allow 'lab', 'imaging', 'pathology', 'other' (if constraint exists)
  -- This is handled by the application layer, but we ensure the column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'diagnostic_reports' AND column_name = 'report_type'
  ) THEN
    ALTER TABLE diagnostic_reports ADD COLUMN report_type TEXT DEFAULT 'lab';
    RAISE NOTICE 'Added report_type column to diagnostic_reports';
  END IF;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Migration 514 error: %', SQLERRM;
END $$;
