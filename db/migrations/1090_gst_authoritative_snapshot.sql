-- ============================================================================
-- 1090: Authoritative customer GST snapshot columns
-- Service / package / meal payments + package purchases + meal orders + daily accrual.
-- Additive and idempotent. Does not rewrite historical GST amounts or vendor earnings.
-- ============================================================================

-- payments: jurisdiction + taxable context (split columns already exist)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_inter_state BOOLEAN;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS taxable_amount NUMERIC(12, 2);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(6, 2);

COMMENT ON COLUMN payments.is_inter_state IS
  'Authoritative place-of-supply: true = IGST, false = CGST+SGST. NULL = unknown (legacy).';
COMMENT ON COLUMN payments.taxable_amount IS
  'Customer GST taxable base used at charge time (post-discount exclusive).';
COMMENT ON COLUMN payments.gst_rate IS
  'Statutory GST % applied at charge time.';

-- package_purchases: full split (tax_rate / tax_amount / total_with_tax already exist)
ALTER TABLE package_purchases ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(12, 2);
ALTER TABLE package_purchases ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(12, 2);
ALTER TABLE package_purchases ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(12, 2);
ALTER TABLE package_purchases ADD COLUMN IF NOT EXISTS is_inter_state BOOLEAN;
ALTER TABLE package_purchases ADD COLUMN IF NOT EXISTS taxable_amount NUMERIC(12, 2);

COMMENT ON COLUMN package_purchases.cgst_amount IS
  'Customer package-purchase CGST (intra-state). Not allocated to sessions.';
COMMENT ON COLUMN package_purchases.sgst_amount IS
  'Customer package-purchase SGST (intra-state). Not allocated to sessions.';
COMMENT ON COLUMN package_purchases.igst_amount IS
  'Customer package-purchase IGST (inter-state). Not allocated to sessions.';
COMMENT ON COLUMN package_purchases.is_inter_state IS
  'Authoritative package-purchase GST regime. NULL = unknown (legacy).';

-- meal_orders: persist customer GST (vendor settlement stays food-only)
ALTER TABLE meal_orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2);
ALTER TABLE meal_orders ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(12, 2);
ALTER TABLE meal_orders ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(12, 2);
ALTER TABLE meal_orders ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(12, 2);
ALTER TABLE meal_orders ADD COLUMN IF NOT EXISTS is_inter_state BOOLEAN;
ALTER TABLE meal_orders ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(6, 2);

COMMENT ON COLUMN meal_orders.tax_amount IS
  'Customer-paid total GST (food + delivery). Not vendor settlement.';
COMMENT ON COLUMN meal_orders.is_inter_state IS
  'Authoritative meal GST regime. NULL = unknown (legacy).';

-- vendor_daily_accrual: customer GST visibility (separate from vendor net).
-- NULL = not yet persisted (legacy snapshot); do not default 0 or GET will hide live GST.
ALTER TABLE vendor_daily_accrual ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(14, 2);
ALTER TABLE vendor_daily_accrual ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(14, 2);
ALTER TABLE vendor_daily_accrual ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(14, 2);
ALTER TABLE vendor_daily_accrual ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(14, 2);

COMMENT ON COLUMN vendor_daily_accrual.gst_amount IS
  'Customer GST attributed once per payment/purchase in the IST day. Not part of vendor net.';
