-- MIGRATION 1075: allow zero total_amount for free / fully-discounted bookings
--
-- Why:
-- Production booking create failed with:
--   new row for relation "bookings" violates check constraint "check_booking_amount_positive"
-- when financialMeta.finalPaid (or package/subscription/100% promo) is ₹0.
-- Migration 743 already allowed amount=0 for package session children; legitimate
-- free service bookings (full wallet, 100% promo, subscription) need the same.
--
-- Rule:
-- - total_amount must be >= 0 (non-negative)
-- - base_price constraint unchanged (package sessions still the zero-base exception)

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS check_booking_amount_positive;

ALTER TABLE bookings
  ADD CONSTRAINT check_booking_amount_positive
  CHECK (total_amount >= 0);
