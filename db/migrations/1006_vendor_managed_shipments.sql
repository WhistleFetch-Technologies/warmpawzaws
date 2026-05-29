-- Vendor-managed shipments: AfterShip tracking metadata + poll index

ALTER TABLE shipments ADD COLUMN IF NOT EXISTS aftership_tracking_id TEXT;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS tracking_provider TEXT DEFAULT 'aftership';

CREATE INDEX IF NOT EXISTS idx_shipments_vendor_poll
  ON shipments (fulfillment_type, status, last_polled_at)
  WHERE fulfillment_type = 'vendor';

COMMENT ON COLUMN shipments.aftership_tracking_id IS 'AfterShip tracking id when registered via vendor mark-shipped';
COMMENT ON COLUMN shipments.tracking_provider IS 'Tracking data provider: aftership, manual, etc.';
