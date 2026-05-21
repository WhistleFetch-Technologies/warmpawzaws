-- ============================================================================
-- MIGRATION 755: Pausable consultation slot timer (accidental leave / rejoin)
-- ============================================================================

ALTER TABLE video_call_sessions
  ADD COLUMN IF NOT EXISTS call_timer_remaining_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS call_timer_running_since TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS overlap_segment_started_at TIMESTAMPTZ;

COMMENT ON COLUMN video_call_sessions.call_timer_remaining_seconds IS
  'Frozen slot seconds left when timer paused (participant left or refresh)';
COMMENT ON COLUMN video_call_sessions.call_timer_running_since IS
  'When both parties are present and the slot countdown is actively ticking';
COMMENT ON COLUMN video_call_sessions.overlap_segment_started_at IS
  'Start of current simultaneous-presence segment for overlap accumulation';
