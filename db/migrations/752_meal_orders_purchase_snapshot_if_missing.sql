-- Ensure meal_orders.purchase_snapshot exists (subscription mirror + one-time snapshots; migration 744 may not have run on all envs).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'meal_orders' AND column_name = 'purchase_snapshot'
  ) THEN
    ALTER TABLE meal_orders ADD COLUMN purchase_snapshot JSONB;
    COMMENT ON COLUMN meal_orders.purchase_snapshot IS 'Immutable snapshot of subscription-related fields at order time';
  END IF;
END $$;
