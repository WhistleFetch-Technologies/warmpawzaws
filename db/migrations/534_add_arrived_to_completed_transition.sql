-- ============================================================================
-- Add 'arrived → completed' transition for bookings
-- ============================================================================
-- This migration adds support for transitioning directly from 'arrived' to
-- 'completed', allowing vendors to mark bookings as completed after arriving
-- without necessarily going through 'in_progress' first.
-- ============================================================================

-- Add transition from arrived to completed
INSERT INTO booking_state_transitions (from_status, to_status, allowed) VALUES
    ('arrived', 'completed', true)
ON CONFLICT (from_status, to_status) DO NOTHING;

COMMENT ON TABLE booking_state_transitions IS 'Defines allowed state transitions for bookings (includes arrived → completed)';
