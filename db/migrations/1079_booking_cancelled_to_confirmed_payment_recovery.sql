-- ============================================================================
-- MIGRATION 1079: Allow cancelled → confirmed for paid payment recovery
-- ============================================================================
-- When Razorpay capture succeeds after the 5-minute payment hold auto-cancels
-- a booking (payment_window_expired), verify-payment / reconciliation must be
-- able to re-confirm the booking. Without this row, UPDATE status='confirmed'
-- raises "Invalid state transition from cancelled to confirmed".
-- Application code only uses this path when payment_status is already paid.
-- ============================================================================

INSERT INTO booking_state_transitions (from_status, to_status, allowed)
VALUES ('cancelled', 'confirmed', true)
ON CONFLICT (from_status, to_status) DO NOTHING;

COMMENT ON TABLE booking_state_transitions IS 'Valid booking state transitions (incl. cancelled→confirmed payment recovery, migration 1079)';
