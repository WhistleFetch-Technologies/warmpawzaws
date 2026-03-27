-- Allow hyperlocal integrations (Pidge, Dunzo) on pharmacy and meal orders.
-- Previous CHECK only allowed 'own' | 'warmpawz'.

ALTER TABLE pharmacy_orders DROP CONSTRAINT IF EXISTS pharmacy_orders_logistics_type_check;
ALTER TABLE pharmacy_orders
  ADD CONSTRAINT pharmacy_orders_logistics_type_check
  CHECK (logistics_type IN ('own', 'warmpawz', 'dunzo', 'pidge'));

ALTER TABLE meal_orders DROP CONSTRAINT IF EXISTS meal_orders_logistics_type_check;
ALTER TABLE meal_orders
  ADD CONSTRAINT meal_orders_logistics_type_check
  CHECK (logistics_type IN ('own', 'warmpawz', 'dunzo', 'pidge'));
