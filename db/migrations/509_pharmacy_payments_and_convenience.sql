-- ============================================================================
-- PHARMACY: payments.pharmacy_order_id + pharmacy_orders.convenience_fee
-- Run after 508_pharmacy_orders_status_invoice_generated.sql
-- ============================================================================

-- payments: allow linking to pharmacy order for Razorpay create/verify flow
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'pharmacy_order_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN pharmacy_order_id UUID REFERENCES pharmacy_orders(id);
    CREATE INDEX IF NOT EXISTS idx_payments_pharmacy_order_id ON payments(pharmacy_order_id) WHERE pharmacy_order_id IS NOT NULL;
    RAISE NOTICE 'Added payments.pharmacy_order_id';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'payments.pharmacy_order_id: %', SQLERRM;
END $$;

-- pharmacy_orders: convenience_fee for proforma total (invoice + delivery + platform + convenience)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pharmacy_orders' AND column_name = 'convenience_fee'
  ) THEN
    ALTER TABLE pharmacy_orders ADD COLUMN convenience_fee NUMERIC(10,2) DEFAULT 0;
    RAISE NOTICE 'Added pharmacy_orders.convenience_fee';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pharmacy_orders.convenience_fee: %', SQLERRM;
END $$;
