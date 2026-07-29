-- Backfill commerce_mode for Warmpawz Appointments bookings created before
-- commerce_mode tagging was deployed (flat catalogue fee match on published vendors).

UPDATE bookings b
SET
  commerce_mode = 'warmpawz_appointments',
  commerce_version = COALESCE(b.commerce_version, 1)
FROM warmpawz_appointments_vendor_catalog c
WHERE c.vendor_id = b.vendor_id
  AND c.publish_status = 'published'
  AND (b.commerce_mode IS NULL OR b.commerce_mode = 'marketplace')
  AND ABS(COALESCE(b.base_price, 0) - COALESCE(c.appointment_fee, 0)) < 0.02;
