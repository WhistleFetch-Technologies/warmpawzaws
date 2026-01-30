-- ============================================================================
-- MIGRATION 506: Add diagnostics-specific statuses to bookings
-- ============================================================================
-- Diagnostics flow uses: sample_collected, sample_received_at_lab, processing, reports_ready
-- First normalize any unknown statuses to 'pending', then add extended constraint.
-- ============================================================================

-- Step 1: Find and fix any rows with status not in our target set
DO $$
DECLARE
  target_statuses TEXT[] := ARRAY[
    'pending', 'confirmed', 'scheduled', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled',
    'partially_completed', 'dispatched', 'arrived', 'active', 'paused', 'renewal_pending', 'expired',
    'sample_collected', 'sample_received_at_lab', 'processing', 'reports_ready'
  ];
  cnt INTEGER;
BEGIN
  UPDATE bookings SET status = 'pending'
  WHERE status IS NULL OR status NOT IN (SELECT unnest(target_statuses));
  GET DIAGNOSTICS cnt = ROW_COUNT;
  IF cnt > 0 THEN
    RAISE NOTICE 'Normalized % booking(s) with unknown status to pending', cnt;
  END IF;
END $$;

-- Step 2: Drop old constraint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_status_check') THEN
    ALTER TABLE bookings DROP CONSTRAINT bookings_status_check;
  END IF;
END $$;

-- Step 3: Add new constraint
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK (status IN (
  'pending', 'confirmed', 'scheduled', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled',
  'partially_completed', 'dispatched', 'arrived', 'active', 'paused', 'renewal_pending', 'expired',
  'sample_collected', 'sample_received_at_lab', 'processing', 'reports_ready'
));

COMMENT ON COLUMN bookings.status IS 'Booking status. Diagnostics: sample_collected, sample_received_at_lab, processing, reports_ready';
