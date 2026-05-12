-- Denormalized purchase / subscription fields for meal catalog & orders (JSON remains source of truth in dietary_requirements / metadata).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'purchase_type') THEN
    ALTER TABLE products ADD COLUMN purchase_type TEXT;
    COMMENT ON COLUMN products.purchase_type IS 'ONE_TIME | WEEKLY_PLAN | MONTHLY_PLAN — mirrors metadata.purchaseType';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'subscription_config') THEN
    ALTER TABLE products ADD COLUMN subscription_config JSONB;
    COMMENT ON COLUMN products.subscription_config IS 'Vendor subscription options snapshot; mirrors metadata.subscriptionConfig';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'meal_plans' AND column_name = 'purchase_type') THEN
    ALTER TABLE meal_plans ADD COLUMN purchase_type TEXT;
    COMMENT ON COLUMN meal_plans.purchase_type IS 'ONE_TIME | WEEKLY_PLAN | MONTHLY_PLAN — mirrors dietary_requirements.purchaseType';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'meal_plans' AND column_name = 'subscription_config') THEN
    ALTER TABLE meal_plans ADD COLUMN subscription_config JSONB;
    COMMENT ON COLUMN meal_plans.subscription_config IS 'Vendor subscription options snapshot';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'meal_orders' AND column_name = 'purchase_type') THEN
    ALTER TABLE meal_orders ADD COLUMN purchase_type TEXT;
    COMMENT ON COLUMN meal_orders.purchase_type IS 'Purchase mode at checkout (must match meal_plans catalog)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'meal_orders' AND column_name = 'purchase_snapshot') THEN
    ALTER TABLE meal_orders ADD COLUMN purchase_snapshot JSONB;
    COMMENT ON COLUMN meal_orders.purchase_snapshot IS 'Immutable snapshot of subscription-related fields at order time';
  END IF;
END $$;
