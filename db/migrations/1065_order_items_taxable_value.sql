-- ============================================================================
-- MIGRATION 1065: order_items.taxable_value (ex-GST commission base)
-- ============================================================================
-- Commission MUST always be computed on the original ex-GST taxable value of
-- each line (T = P / (1 + gst%/100)), never on the GST-inclusive line total and
-- never reduced for a discount. Persisting T per line at order-creation time
-- means later reconciliation passes (webhook, Razorpay create-order refresh,
-- settlement ledger) read the same value instead of re-deriving it differently.
-- ============================================================================

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS taxable_value NUMERIC(12, 2);

COMMENT ON COLUMN order_items.taxable_value IS
  'Ex-GST taxable value of this line at order creation (unit_price x qty, GST removed). Commission base — see resolve-ecommerce-commission-rate.ts. NULL on orders created before this migration; loadOrderLineItemsForCommission falls back to total_price for those.';
