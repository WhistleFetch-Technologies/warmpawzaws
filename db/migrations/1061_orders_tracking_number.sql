-- Compatibility mirror for e-commerce order tracking (source of truth: shipments.awb_code).
-- Backend customer/vendor order APIs SELECT and UPDATE orders.tracking_number.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_partner VARCHAR(100);

COMMENT ON COLUMN orders.tracking_number IS 'Legacy mirror of shipment AWB/tracking number for order list APIs';
COMMENT ON COLUMN orders.delivery_partner IS 'Carrier or logistics partner display name when vendor marks order shipped';
