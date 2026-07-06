-- Phase 6: Commission, Settlement & Promotion Deduction
-- Add top-level promotion tracking and vendor payout columns to orders table.
-- These allow the settlement calculator to correctly attribute discounts
-- (vendor vs admin funded) and store the final vendor payout amount at
-- payment-verification time without re-computing on every API call.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS promotion_source        TEXT,
  ADD COLUMN IF NOT EXISTS vendor_promotion_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_promotion_amount  NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vendor_payout_amount    NUMERIC(10, 2);

CREATE INDEX IF NOT EXISTS idx_orders_promotion_source
  ON orders (promotion_source)
  WHERE promotion_source IS NOT NULL;

COMMENT ON COLUMN orders.promotion_source IS
  'vendor = discount absorbed by vendor settlement payout; admin = discount absorbed by Warmpawz revenue';
COMMENT ON COLUMN orders.vendor_promotion_amount IS
  'Amount of vendor-funded discount; deducted from vendor payout: payout = (subtotal - vendor_promotion_amount) - commission';
COMMENT ON COLUMN orders.admin_promotion_amount IS
  'Amount of admin (Warmpawz)-funded discount; deducted from Warmpawz revenue, vendor payout unaffected';
COMMENT ON COLUMN orders.vendor_payout_amount IS
  'Final vendor payout stored at payment verification: GREATEST(subtotal - vendor_promotion_amount - commission_amount, 0)';
