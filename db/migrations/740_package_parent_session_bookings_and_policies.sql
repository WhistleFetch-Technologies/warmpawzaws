-- ============================================================================
-- MIGRATION 740: Package parent/session bookings + policy acceptance
-- ============================================================================
-- Purpose:
--  1. Introduce a parent/child booking relationship for package purchases:
--     - 1 parent canonical booking per package_purchases row (is_package_session = false).
--     - N child session bookings, one per package_scheduled_sessions row
--       (is_package_session = true, parent_booking_id = parent.id).
--  2. Persist refund/cancellation policy snapshots and customer acceptance on
--     package_purchases so payment cannot proceed without explicit consent.
--
-- Compatibility:
--   - Migration 738 created a unique index on (package_purchase_id,
--     package_session_number) without scoping to children. Migration 739
--     reverted that index in favor of a single canonical package booking.
--   - This migration re-introduces session uniqueness but ONLY when the row
--     is a child session (parent_booking_id IS NOT NULL), so it cannot
--     collide with the canonical package booking from migration 739.
-- ============================================================================

BEGIN;

-- 1) bookings.parent_booking_id ------------------------------------------------

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS parent_booking_id UUID REFERENCES bookings(id);

COMMENT ON COLUMN bookings.parent_booking_id IS
    'Parent canonical booking for package session children. NULL for normal bookings and the canonical package parent.';

CREATE INDEX IF NOT EXISTS idx_bookings_parent_booking_id
    ON bookings(parent_booking_id)
    WHERE parent_booking_id IS NOT NULL;

-- Ensure exactly one child booking per (package_purchase_id, session_number).
-- Scoped to children (parent_booking_id IS NOT NULL) so it does not conflict
-- with the canonical parent created via migration 739's lookup pattern.
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_unique_package_session_child
    ON bookings (package_purchase_id, package_session_number)
    WHERE parent_booking_id IS NOT NULL
      AND package_session_number IS NOT NULL
      AND COALESCE(is_package_session, false) = true;

-- 2) package_purchases policy snapshot + acceptance ----------------------------

ALTER TABLE package_purchases
    ADD COLUMN IF NOT EXISTS cancellation_policy TEXT;

ALTER TABLE package_purchases
    ADD COLUMN IF NOT EXISTS refund_policy TEXT;

ALTER TABLE package_purchases
    ADD COLUMN IF NOT EXISTS policy_version TEXT;

ALTER TABLE package_purchases
    ADD COLUMN IF NOT EXISTS policy_accepted_at TIMESTAMPTZ;

ALTER TABLE package_purchases
    ADD COLUMN IF NOT EXISTS policy_accepted_meta JSONB;

COMMENT ON COLUMN package_purchases.cancellation_policy IS
    'Snapshot of cancellation policy text shown to and accepted by the customer at purchase.';

COMMENT ON COLUMN package_purchases.refund_policy IS
    'Snapshot of refund policy text shown to and accepted by the customer at purchase.';

COMMENT ON COLUMN package_purchases.policy_version IS
    'Hash / version identifier of the (cancellation_policy + refund_policy) snapshot for auditability.';

COMMENT ON COLUMN package_purchases.policy_accepted_at IS
    'Timestamp at which the customer ticked the acceptance checkbox before payment.';

COMMENT ON COLUMN package_purchases.policy_accepted_meta IS
    'Free-form acceptance metadata (e.g. user agent, IP-derived hash) for compliance.';

CREATE INDEX IF NOT EXISTS idx_package_purchases_policy_accepted_at
    ON package_purchases(policy_accepted_at)
    WHERE policy_accepted_at IS NOT NULL;

COMMIT;
