-- ============================================================================
-- MIGRATION 1054: Per-line commission audit + order snapshot column
-- ============================================================================

CREATE TABLE IF NOT EXISTS order_item_commission (
  order_item_id UUID PRIMARY KEY REFERENCES order_items(id),
  product_id UUID,
  commission_rate NUMERIC(5, 2) NOT NULL,
  commission_amount NUMERIC(12, 2) NOT NULL,
  commission_source TEXT NOT NULL,
  listing_ownership TEXT,
  resolved_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_item_commission_product
  ON order_item_commission(product_id);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS commission_snapshot JSONB;

COMMENT ON TABLE order_item_commission IS
  'Audit trail: resolved commission per order line at payment time';
COMMENT ON COLUMN orders.commission_snapshot IS
  'Immutable commission snapshot from Razorpay create-order for webhook/verify alignment';
