-- ============================================================================
-- 1010_meal_orders_pidge_dispatch.sql
--
-- Meal-delivery prep-time-aligned Pidge dispatch (single source of truth in Java
-- delivery-service). The vendor "Start Preparing" click triggers Pidge order
-- creation early enough that the rider arrives by the time the meal is ready.
--
-- New meal_orders columns
--   prep_minutes        INT          -- snapshot from meal_plans.prep_time_minutes at order create.
--   expected_ready_at   TIMESTAMPTZ  -- set on transition to 'preparing'  (= prep_started_at + prep_minutes).
--   pidge_order_id      VARCHAR(255) -- denormalized convenience pointer; truth = delivery_tracking.external_task_id.
--
-- All operations are idempotent so the migration is safe to re-run on dev.
-- ============================================================================

ALTER TABLE meal_orders
  ADD COLUMN IF NOT EXISTS prep_minutes      INTEGER,
  ADD COLUMN IF NOT EXISTS expected_ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pidge_order_id    VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_meal_orders_pidge_order_id
  ON meal_orders (pidge_order_id)
  WHERE pidge_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meal_orders_expected_ready_at
  ON meal_orders (expected_ready_at)
  WHERE expected_ready_at IS NOT NULL;

COMMENT ON COLUMN meal_orders.prep_minutes      IS 'Vendor-declared meal prep time (minutes), snapshot of meal_plans.prep_time_minutes at order create.';
COMMENT ON COLUMN meal_orders.expected_ready_at IS 'When meal is expected to be ready for rider pickup. Set on transition to status=preparing (= prep_started_at + prep_minutes).';
COMMENT ON COLUMN meal_orders.pidge_order_id    IS 'Latest Pidge order id for this meal_order. Truth lives on delivery_tracking.external_task_id.';
