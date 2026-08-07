-- ============================================================================
-- MIGRATION 1094: Warmpawz Pay — appointment fee credit idempotency table
-- ============================================================================
-- Purpose: One appointment-fee credit per booking (S05/S07 wappt_pay_settlement plan).
-- Idempotent: safe to re-run
-- Additive only
-- ============================================================================

CREATE TABLE IF NOT EXISTS warmpawz_pay_appointment_credits (
  booking_id UUID PRIMARY KEY REFERENCES bookings(id),
  payment_id UUID NOT NULL REFERENCES payments(id),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wpay_appointment_credits_payment_id
  ON warmpawz_pay_appointment_credits (payment_id);

COMMENT ON TABLE warmpawz_pay_appointment_credits IS
  'Tracks appointment fee credits applied to Pay Bill payments; one row per booking ever.';

COMMENT ON COLUMN warmpawz_pay_appointment_credits.booking_id IS
  'Booking whose appointment fee was credited toward a Pay Bill payment.';

COMMENT ON COLUMN warmpawz_pay_appointment_credits.payment_id IS
  'Warmpawz Pay payment that consumed the appointment fee credit.';

COMMENT ON COLUMN warmpawz_pay_appointment_credits.amount IS
  'Appointment fee amount credited (INR).';

COMMENT ON COLUMN warmpawz_pay_appointment_credits.consumed_at IS
  'When the credit was recorded at payment initiate/verify.';
