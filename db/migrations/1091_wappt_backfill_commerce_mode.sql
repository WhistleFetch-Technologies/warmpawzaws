-- Backfill commerce_mode for Warmpawz Appointments bookings created before
-- commerce_mode tagging was deployed (flat catalogue fee match on published vendors).
-- SAFETY: only rows with NULL commerce_mode (never re-tag marketplace).

UPDATE bookings b
SET
  commerce_mode = 'warmpawz_appointments',
  commerce_version = COALESCE(b.commerce_version, 1)
FROM warmpawz_appointments_vendor_catalog c
WHERE c.vendor_id = b.vendor_id
  AND c.publish_status = 'published'
  AND b.commerce_mode IS NULL
  AND b.created_at >= c.published_at
  AND ABS(COALESCE(b.base_price, 0) - COALESCE(c.appointment_fee, 0)) < 0.02
  AND COALESCE(b.base_price, 0) > 0
  AND COALESCE(c.appointment_fee, 0) > 0;
