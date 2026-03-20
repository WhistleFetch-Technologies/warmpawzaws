-- ============================================================================
-- Add 'arrived' status transitions for bookings
-- ============================================================================
-- This migration adds support for the 'arrived' status, which is used when
-- a vendor arrives at the customer's location before starting the service.
--
-- Allowed transitions:
--   - confirmed → arrived (vendor arrives at location)
--   - arrived → in_progress (vendor starts service after arrival)
--   - arrived → cancelled (vendor cancels after arrival)
-- ============================================================================

-- Add transitions for 'arrived' status
-- Note: Production table only has from_status, to_status, and allowed columns
INSERT INTO booking_state_transitions (from_status, to_status, allowed) VALUES
    -- Vendor arrives at location
    ('confirmed', 'arrived', true),
    
    -- After arrival, vendor can start service or cancel
    ('arrived', 'in_progress', true),
    ('arrived', 'cancelled', true)
ON CONFLICT (from_status, to_status) DO NOTHING;

COMMENT ON TABLE booking_state_transitions IS 'Defines allowed state transitions for bookings (includes arrived status)';
