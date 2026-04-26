-- ============================================================================
-- MIGRATION 735: Add pending_payment transitions to booking_state_transitions
-- ============================================================================
-- Date: 2026-04-26
-- Purpose: Fix prod-only failure where `UPDATE bookings SET status='confirmed'`
--          from `pending_payment` is blocked by the state-machine trigger
--          installed by migration 010 (or 046 in alt environments), causing
--          Razorpay-paid bookings to remain stuck in `pending_payment` after
--          successful capture.
--
-- Symptom (prod): "Invalid state transition from pending_payment to confirmed"
--   raised by `enforce_booking_state_machine()` (010_complete_kv_to_sql_migration.sql)
--   and surfaced via /razorpay/verify-payment's catch as
--   "Payment verification encountered an error: Invalid state transition...".
--
-- Prod schema (verified via inspect-prod-state-machine.js):
--   booking_state_transitions(from_status TEXT, to_status TEXT, allowed BOOL)
-- Dev/alt schema (migration 046):
--   booking_state_transitions(..., requires_payment BOOL, requires_vendor_approval, ...)
--
-- Strategy: insert via DO block that adapts to whichever column set exists.
--   - If `requires_payment` column is present (046 schema), insert with
--     requires_payment=false (the verify-payment UPDATE sets payment_status
--     and status in the SAME UPDATE; the validator reads OLD payment_status,
--     so requires_payment=true would always block. Razorpay signature
--     verification at the application layer is the actual gatekeeper).
--   - Otherwise (010 schema with `allowed` only), insert (from, to, allowed=true).
--
-- Idempotent: ON CONFLICT (from_status, to_status) DO NOTHING.
-- ============================================================================

DO $mig_pp$
DECLARE
    has_requires_payment BOOLEAN;
    has_allowed          BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'booking_state_transitions'
          AND column_name  = 'requires_payment'
    ) INTO has_requires_payment;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'booking_state_transitions'
          AND column_name  = 'allowed'
    ) INTO has_allowed;

    IF has_requires_payment THEN
        /* migration 046 schema (extra columns). */
        INSERT INTO booking_state_transitions (from_status, to_status, requires_payment, description) VALUES
            ('pending_payment', 'confirmed',       false, 'Razorpay capture confirmed by verify-payment or webhook'),
            ('pending_payment', 'cancelled',       false, 'Razorpay payment failed/abandoned; release held slot'),
            ('pending_payment', 'rescheduled',     false, 'Reschedule held slot before payment completes'),
            ('pending',         'pending_payment', false, 'Move pending booking to held-slot/awaiting capture')
        ON CONFLICT (from_status, to_status) DO NOTHING;

    ELSIF has_allowed THEN
        /* migration 010 schema (prod): (from_status, to_status, allowed). */
        INSERT INTO booking_state_transitions (from_status, to_status, allowed) VALUES
            ('pending_payment', 'confirmed',       true),
            ('pending_payment', 'cancelled',       true),
            ('pending_payment', 'rescheduled',     true),
            ('pending',         'pending_payment', true)
        ON CONFLICT (from_status, to_status) DO NOTHING;

    ELSE
        /* Fallback: minimal columns only. */
        INSERT INTO booking_state_transitions (from_status, to_status) VALUES
            ('pending_payment', 'confirmed'),
            ('pending_payment', 'cancelled'),
            ('pending_payment', 'rescheduled'),
            ('pending',         'pending_payment')
        ON CONFLICT (from_status, to_status) DO NOTHING;
    END IF;
END
$mig_pp$;

COMMENT ON TABLE booking_state_transitions IS 'Valid booking state transitions (incl. pending_payment paths after migration 735)';
