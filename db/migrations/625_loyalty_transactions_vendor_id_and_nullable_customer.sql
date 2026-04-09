-- ============================================================================
-- 625: Align loyalty_transactions with vendor referral / loyalty earn path
-- ============================================================================
-- Live check (2026): DEV has vendor_id + nullable customer_id; PROD lacked
-- vendor_id and had customer_id NOT NULL — vendor INSERTs from Lambda fail on PROD.
-- ============================================================================

ALTER TABLE loyalty_transactions
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;

ALTER TABLE loyalty_transactions
  ALTER COLUMN customer_id DROP NOT NULL;

COMMENT ON COLUMN loyalty_transactions.vendor_id IS 'Vendor who earned points when user_type is vendor (e.g. referral rewards); customer_id may be NULL';

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_vendor_id
  ON loyalty_transactions (vendor_id)
  WHERE vendor_id IS NOT NULL;
