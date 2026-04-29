-- Revert session-fanout uniqueness; package sessions share one canonical package booking.
DROP INDEX IF EXISTS idx_bookings_unique_package_session;

-- Speed up canonical booking lookup by package purchase and booking class.
CREATE INDEX IF NOT EXISTS idx_bookings_package_purchase_canonical_lookup
ON bookings (package_purchase_id, is_package_session, created_at);
