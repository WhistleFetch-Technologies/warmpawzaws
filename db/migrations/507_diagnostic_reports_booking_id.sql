-- Ensure diagnostic_reports has booking_id for diagnostics flow (uses bookings table)
-- Some schemas use diagnostic_booking_id (references diagnostic_bookings); we need booking_id for our flow.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'diagnostic_reports')
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'diagnostic_reports' AND column_name = 'booking_id'
  ) THEN
    BEGIN
      ALTER TABLE diagnostic_reports ADD COLUMN booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_diagnostic_reports_booking_id_new ON diagnostic_reports(booking_id) WHERE booking_id IS NOT NULL;
      RAISE NOTICE 'Added booking_id column to diagnostic_reports';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not add booking_id: %', SQLERRM;
    END;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Migration 507: %', SQLERRM;
END $$;
