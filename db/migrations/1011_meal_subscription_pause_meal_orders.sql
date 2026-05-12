-- Pause/resume for canonical meal subscriptions: operational delivery rows + mirrored meal_orders.
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- meal_subscription_deliveries: paused + restore hint
-- ---------------------------------------------------------------------------
ALTER TABLE meal_subscription_deliveries
  ADD COLUMN IF NOT EXISTS pre_pause_delivery_status VARCHAR(32);

ALTER TABLE meal_subscription_deliveries DROP CONSTRAINT IF EXISTS meal_subscription_deliveries_status_check;

ALTER TABLE meal_subscription_deliveries
  ADD CONSTRAINT meal_subscription_deliveries_status_check CHECK (
    status IN (
      'scheduled',
      'preparing',
      'ready',
      'assigned',
      'out_for_delivery',
      'delivered',
      'skipped',
      'rescheduled',
      'cancelled',
      'failed',
      'paused'
    )
  );

COMMENT ON COLUMN meal_subscription_deliveries.pre_pause_delivery_status IS 'Session status before customer paused the subscription; restored on resume.';

-- ---------------------------------------------------------------------------
-- meal_orders: paused + restore hint (vendor nutrition queue)
-- ---------------------------------------------------------------------------
ALTER TABLE meal_orders
  ADD COLUMN IF NOT EXISTS pre_pause_order_status VARCHAR(30);

ALTER TABLE meal_orders DROP CONSTRAINT IF EXISTS meal_orders_status_check;

ALTER TABLE meal_orders
  ADD CONSTRAINT meal_orders_status_check CHECK (status IN (
    'pending',
    'placed',
    'confirmed',
    'accepted',
    'preparing',
    'ready',
    'ready_for_pickup',
    'picked_up',
    'on_the_way',
    'delivered',
    'cancelled',
    'dispatched',
    'paused'
  ));

COMMENT ON COLUMN meal_orders.pre_pause_order_status IS 'meal_orders.status before subscription pause; restored on resume.';
