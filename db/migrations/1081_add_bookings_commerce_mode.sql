-- Add per-booking commerce mode freeze columns for Commerce Switch integration.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS commerce_mode TEXT,
  ADD COLUMN IF NOT EXISTS commerce_version INTEGER;

COMMENT ON COLUMN bookings.commerce_mode IS 'Frozen commerce model at booking creation (marketplace, warmpawz_pay, etc.).';
COMMENT ON COLUMN bookings.commerce_version IS 'Commerce Switch configuration version at booking creation.';

CREATE INDEX IF NOT EXISTS idx_bookings_commerce_mode ON bookings (commerce_mode)
  WHERE commerce_mode IS NOT NULL;
