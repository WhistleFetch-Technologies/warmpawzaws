-- ============================================================================
-- MIGRATION 741: Exclude package parent canonical bookings from slot uniqueness
-- ============================================================================
-- Purpose:
--   Migration 401 created a partial unique index on
--     bookings(vendor_id, booking_date, booking_time)
--   that fires for every confirmed row with staff_id IS NULL.
--
--   Migration 740 introduced a parent + per-session-children booking model for
--   package purchases. The parent canonical booking is NOT a real slot — it's
--   a metadata/chat/messaging anchor — but it is anchored at session 1's
--   date/time so the vendor calendar can find it. That means parent and child
--   session 1 share (vendor_id, booking_date, booking_time) and BOTH are
--   confirmed + staff_id IS NULL, which violates the partial unique index.
--
--   Fix: exclude package parent canonical rows
--     (package_purchase_id IS NOT NULL AND is_package_session = false)
--   from the uniqueness check. Real session children
--     (is_package_session = true)
--   keep slot uniqueness against each other and against normal bookings.
-- ============================================================================

BEGIN;

-- 1) vendor-level slot uniqueness ----------------------------------------------

DROP INDEX IF EXISTS idx_booking_slot_vendor_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_slot_vendor_unique
ON bookings (vendor_id, booking_date, booking_time)
WHERE staff_id IS NULL
  AND status = 'confirmed'
  AND NOT (
    package_purchase_id IS NOT NULL
    AND COALESCE(is_package_session, false) = false
  );

COMMENT ON INDEX idx_booking_slot_vendor_unique IS
  'Prevents double-booking at vendor level for confirmed bookings; package parent canonical rows (package_purchase_id IS NOT NULL AND is_package_session = false) are excluded so they can share the slot with their first child session.';

-- 2) staff-level slot uniqueness ----------------------------------------------

DROP INDEX IF EXISTS idx_booking_slot_staff_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_slot_staff_unique
ON bookings (vendor_id, staff_id, booking_date, booking_time)
WHERE staff_id IS NOT NULL
  AND status = 'confirmed'
  AND NOT (
    package_purchase_id IS NOT NULL
    AND COALESCE(is_package_session, false) = false
  );

COMMENT ON INDEX idx_booking_slot_staff_unique IS
  'Prevents double-booking at staff level for confirmed bookings; package parent canonical rows are excluded.';

COMMIT;
