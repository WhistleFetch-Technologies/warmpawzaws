-- ============================================================================
-- MIGRATION 753: Align bookings table with booking-service JPA entity
-- ============================================================================
-- The Java booking-service (ECS) maps columns that Node/Lambda create path may
-- store in the single `address` field only. Without these columns Hibernate
-- fails on duplicate/overlap checks with: column b1_0.address_line1 does not exist
-- ============================================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS address_line1 TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS address_line2 TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_style TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS flow_variant TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reschedule_reason TEXT;

COMMENT ON COLUMN bookings.address_line1 IS 'Structured address line 1 (booking-service entity)';
COMMENT ON COLUMN bookings.address_line2 IS 'Structured address line 2 (booking-service entity)';
COMMENT ON COLUMN bookings.service_style IS 'Delivery style mirror: at_center, at_home, tele, etc.';
COMMENT ON COLUMN bookings.flow_variant IS 'Flow variant e.g. pet_sitting for at_home timed visits';
COMMENT ON COLUMN bookings.reschedule_reason IS 'Reason recorded when booking was rescheduled';

-- From migration 541 (often missing on dev if 541 was never applied)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS estimated_arrival TIMESTAMPTZ;
COMMENT ON COLUMN bookings.estimated_arrival IS 'Estimated arrival time for at_home bookings (commute ETA)';

-- From migration 616
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS otp_verified_at TIMESTAMPTZ;
COMMENT ON COLUMN bookings.otp_verified_at IS 'Timestamp when OTP was verified for the booking';

-- From migration 006
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vendor_timezone TEXT DEFAULT 'Asia/Kolkata';
COMMENT ON COLUMN bookings.vendor_timezone IS 'Vendor timezone for correct time interpretation';

-- From migration 011/016
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;
COMMENT ON COLUMN bookings.settled_at IS 'When booking settlement was completed';

-- From migration 074/541
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS room_id UUID;
COMMENT ON COLUMN bookings.room_id IS 'Assigned consultation room for at_center bookings';

-- From migration 541
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS selected_services JSONB;
COMMENT ON COLUMN bookings.selected_services IS 'Multi-service line items JSON (also in booking_service table)';
