-- MIGRATION 744: allow package-session booking rows with zero base_price
--
-- Why:
-- Package purchase flow creates child booking rows for each session where payment
-- is already captured at purchase level. Those rows can have base_price = 0.
-- Existing constraint `check_booking_base_price_positive` rejected them.
--
-- Rule:
-- - Normal bookings must still have base_price > 0
-- - Package session child bookings (is_package_session = true) may be zero

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS check_booking_base_price_positive;

ALTER TABLE bookings
  ADD CONSTRAINT check_booking_base_price_positive
  CHECK (
    COALESCE(is_package_session, false)
    OR base_price > 0
  );

