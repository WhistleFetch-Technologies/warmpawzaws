-- Ensure one booking row per package session number (idempotent scheduling).
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_unique_package_session
ON bookings (package_purchase_id, package_session_number)
WHERE package_purchase_id IS NOT NULL
  AND package_session_number IS NOT NULL
  AND COALESCE(is_package_session, false) = true;
