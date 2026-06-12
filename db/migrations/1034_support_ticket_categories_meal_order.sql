-- Expand support ticket issue categories + link meal_orders without violating orders FK.

ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_category_check;

ALTER TABLE support_tickets
ADD CONSTRAINT support_tickets_category_check
CHECK (category IN (
  'general',
  'technical',
  'billing',
  'account',
  'service',
  'other',
  'cancellation',
  'delivery',
  'wrong_items',
  'quality'
));

ALTER TABLE support_tickets
ADD COLUMN IF NOT EXISTS meal_order_id UUID REFERENCES meal_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_support_tickets_meal_order_id
  ON support_tickets (meal_order_id)
  WHERE meal_order_id IS NOT NULL;

COMMENT ON COLUMN support_tickets.meal_order_id IS 'FK to meal_orders for meal-plan delivery tickets (order_id points at orders table only)';
