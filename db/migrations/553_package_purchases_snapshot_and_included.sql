-- ============================================================================
-- MIGRATION 553: Package snapshot and "what's included" support
-- ============================================================================
-- Purpose: Add package_snapshot JSONB to package_purchases for storing
-- included services at purchase time; enables "what's included" and
-- "in your package" labels for vendor-specific packages.
-- ============================================================================

ALTER TABLE package_purchases
  ADD COLUMN IF NOT EXISTS package_snapshot JSONB;

COMMENT ON COLUMN package_purchases.package_snapshot IS 'Snapshot at purchase: { includedServices: [{ id, name }], packageName?, totalSessions? } for display and inActivePackage matching';

-- Partial index: only active, non-exhausted rows (expires_at filtered in queries; NOW() not allowed in predicate)
CREATE INDEX IF NOT EXISTS idx_package_purchases_customer_vendor_active
  ON package_purchases(customer_id, vendor_id)
  WHERE status = 'active' AND (remaining_sessions > 0 OR unlimited_usage = true);
