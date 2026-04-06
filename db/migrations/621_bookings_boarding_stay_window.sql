-- Boarding / multi-day stays: persist check-in and check-out dates and checkout time
-- alongside booking_date + booking_time (check-in wall clock).
-- Used by customer boarding flow, vendor resort views, and occupancy queries.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS check_in_date DATE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS check_out_date DATE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS check_out_time TIME;

COMMENT ON COLUMN bookings.check_in_date IS 'Stay window start date (typically same as booking_date for boarding)';
COMMENT ON COLUMN bookings.check_out_date IS 'Stay window end date for boarding / multi-day';
COMMENT ON COLUMN bookings.check_out_time IS 'Planned check-out time on check_out_date';
