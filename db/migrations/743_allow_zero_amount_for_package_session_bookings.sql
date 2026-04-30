-- MIGRATION 743: allow package-session booking rows with zero amount
--
-- Why:
-- Package flows create one parent booking (paid total) and child session bookings
-- that are informational/scheduling rows with total_amount = 0. The old constraint
-- `check_booking_amount_positive` rejected these child rows and caused:
--   new row for relation "bookings" violates check constraint "check_booking_amount_positive"
--
-- Rule:
-- - Normal bookings must still have total_amount > 0
-- - Package session child bookings (is_package_session = true) may be zero amount

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS check_booking_amount_positive;

ALTER TABLE bookings
  ADD CONSTRAINT check_booking_amount_positive
  CHECK (
    COALESCE(is_package_session, false)
    OR total_amount > 0
  );

