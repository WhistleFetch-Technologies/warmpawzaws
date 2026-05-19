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
