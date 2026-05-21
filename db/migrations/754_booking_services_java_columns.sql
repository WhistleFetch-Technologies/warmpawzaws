-- ============================================================================
-- MIGRATION 754: Align booking_services columns with Java booking-service
-- ============================================================================
-- Java booking-service inserts duration_minutes + price; Lambda migration 502
-- created service_duration + service_price. Add aliases and backfill.
-- ============================================================================

ALTER TABLE booking_services
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2);

UPDATE booking_services
SET duration_minutes = COALESCE(duration_minutes, service_duration, 30)
WHERE duration_minutes IS NULL;

UPDATE booking_services
SET price = COALESCE(price, service_price, 0)
WHERE price IS NULL;

COMMENT ON COLUMN booking_services.duration_minutes IS 'Service duration in minutes (Java booking-service column)';
COMMENT ON COLUMN booking_services.price IS 'Line item price (Java booking-service column)';
