-- 742_repair_package_scheduled_sessions_booking_id.sql
--
-- Earlier versions of buildPackageSessionsResponse() in package-booking.ts
-- ran a destructive UPDATE that clobbered package_scheduled_sessions.booking_id
-- with the parent canonical booking id for every session row in a package
-- purchase. That made the customer-facing /packages/:id/sessions response
-- return the parent booking id for every session, while the vendor calendar
-- (which queries the bookings table directly) still showed the real per-
-- session child booking ids — so customer trackers and vendor GPS sessions
-- pointed at different booking rows.
--
-- This migration repairs any row whose booking_id is currently linked to a
-- non-child booking by re-pointing it at the matching child session booking
-- (`is_package_session = true`, `parent_booking_id IS NOT NULL`,
-- `package_session_number = pss.session_number`). Rows that already point at
-- the correct child are left untouched. Rows with no matching child fall back
-- to NULL so the read path can recover them lazily once a child exists.

UPDATE package_scheduled_sessions pss
SET booking_id = b.id, updated_at = NOW()
FROM bookings b
WHERE b.package_purchase_id = pss.package_purchase_id
  AND COALESCE(b.is_package_session, false) = true
  AND b.parent_booking_id IS NOT NULL
  AND b.package_session_number = pss.session_number
  AND pss.booking_id IS DISTINCT FROM b.id;

-- For rows that still point at a parent canonical booking but have no child
-- session yet (older purchases), null out the booking_id so the read path
-- backfills it the next time the child is created.
UPDATE package_scheduled_sessions pss
SET booking_id = NULL, updated_at = NOW()
FROM bookings b
WHERE pss.booking_id = b.id
  AND b.package_purchase_id = pss.package_purchase_id
  AND COALESCE(b.is_package_session, false) = false
  AND b.parent_booking_id IS NULL;
