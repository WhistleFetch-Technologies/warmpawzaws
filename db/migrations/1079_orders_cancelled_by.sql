-- Shop order cancel/refund hardening: cancelled_by + refund retry index
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_by TEXT;
COMMENT ON COLUMN orders.cancelled_by IS 'pet_parent | provider | system — who initiated cancellation';

CREATE INDEX IF NOT EXISTS idx_orders_cancelled_by ON orders (cancelled_by) WHERE cancelled_by IS NOT NULL;

-- Link shop refunds to orders (used by cancel/return orchestrator)
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON refunds (order_id) WHERE order_id IS NOT NULL;

ALTER TABLE refunds ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0;

-- Sweeper-friendly partial index for shop refund retry (bounded scans)
CREATE INDEX IF NOT EXISTS idx_refunds_shop_retry
  ON refunds (requested_at ASC)
  WHERE order_id IS NOT NULL
    AND refund_status IN ('pending', 'failed');
