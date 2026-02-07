-- Add columns to orders table for meal plan delivery flow (vendor GET /vendor/:vendorId/meal-orders reads from orders)
-- Enables OBJECTIVE 2: Vendor sees meal orders created via POST /nutrition/delivery-orders

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_type') THEN
    ALTER TABLE orders ADD COLUMN order_type TEXT;
    COMMENT ON COLUMN orders.order_type IS 'e.g. meal_plan_delivery, ecommerce';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivery_date') THEN
    ALTER TABLE orders ADD COLUMN delivery_date DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivery_time') THEN
    ALTER TABLE orders ADD COLUMN delivery_time TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_method') THEN
    ALTER TABLE orders ADD COLUMN payment_method TEXT;
  END IF;
END $$;
