-- ============================================================================
-- MIGRATION 728: gps_tracking_sessions — total_distance + session_started_at
-- ============================================================================
-- Purpose: Align RDS with Lambda GPS walk tracking (location-update persists
--          cumulative meters; countdown uses session_started_at).
-- Safe: IF NOT EXISTS per column (idempotent).
-- ============================================================================

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'gps_tracking_sessions' AND column_name = 'total_distance'
    ) THEN
        ALTER TABLE gps_tracking_sessions
        ADD COLUMN total_distance NUMERIC(12, 2) DEFAULT 0;
        COMMENT ON COLUMN gps_tracking_sessions.total_distance IS 'Cumulative in-service walk distance in meters';
        RAISE NOTICE 'Added gps_tracking_sessions.total_distance';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'gps_tracking_sessions' AND column_name = 'session_started_at'
    ) THEN
        ALTER TABLE gps_tracking_sessions
        ADD COLUMN session_started_at TIMESTAMPTZ;
        COMMENT ON COLUMN gps_tracking_sessions.session_started_at IS 'Walk/service countdown anchor (vendor start OTP / in_progress)';
        RAISE NOTICE 'Added gps_tracking_sessions.session_started_at';
    END IF;
END $$;

COMMIT;
