-- Allow pharmacy_orders.status to include invoice_generated, payment_confirmed, dispatched
-- so proforma flow and frontend status labels work without DB constraint errors.
DO $$
BEGIN
  ALTER TABLE pharmacy_orders DROP CONSTRAINT IF EXISTS pharmacy_orders_status_check;
  ALTER TABLE pharmacy_orders ADD CONSTRAINT pharmacy_orders_status_check CHECK (status IN (
    'pending', 'broadcasting', 'accepted', 'invoice_generated', 'payment_confirmed',
    'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way', 'dispatched',
    'delivered', 'cancelled', 'rejected'
  ));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pharmacy_orders status constraint update: %', SQLERRM;
END $$;
