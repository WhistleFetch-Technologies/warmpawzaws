-- ============================================================================
-- MIGRATION 071: Package session in_progress + backfill + idempotent usage log
-- ============================================================================
-- Aligns package_scheduled_sessions.status with product model; backfills rows;
-- prevents duplicate session_used rows per booking for idempotent completion.
-- ============================================================================

-- 1) Allow in_progress on scheduled sessions (drop/re-add named constraint if present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'package_scheduled_sessions'
      AND constraint_name = 'package_scheduled_sessions_status_check'
  ) THEN
    ALTER TABLE package_scheduled_sessions DROP CONSTRAINT package_scheduled_sessions_status_check;
  END IF;
END $$;

ALTER TABLE package_scheduled_sessions
  ADD CONSTRAINT package_scheduled_sessions_status_check
  CHECK (status IN (
    'pending', 'scheduled', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'no_show'
  ));

-- 2) Backfill missing package_scheduled_sessions for existing finite packages
INSERT INTO package_scheduled_sessions (package_purchase_id, session_number, status)
SELECT pp.id, gs.n, 'pending'
FROM package_purchases pp
CROSS JOIN LATERAL generate_series(1, GREATEST(COALESCE(pp.total_sessions, 0), 0)) AS gs(n)
WHERE COALESCE(pp.unlimited_usage, false) = false
  AND COALESCE(pp.total_sessions, 0) > 0
ON CONFLICT (package_purchase_id, session_number) DO NOTHING;

-- 3) At most one session_used audit row per booking (idempotent completion)
CREATE UNIQUE INDEX IF NOT EXISTS idx_package_usage_log_booking_session_used
  ON package_usage_log (booking_id)
  WHERE action = 'session_used' AND booking_id IS NOT NULL;
