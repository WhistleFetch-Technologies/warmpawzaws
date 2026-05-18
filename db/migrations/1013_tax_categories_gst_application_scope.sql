-- ============================================================================
-- MIGRATION 1013: Scoped GST — same catalogue category (e.g. Nutritionist),
-- different tax rows for service bookings vs meal plan food checkout.
-- ============================================================================

ALTER TABLE tax_categories
  ADD COLUMN IF NOT EXISTS gst_application_scope TEXT;

COMMENT ON COLUMN tax_categories.gst_application_scope IS
  'NULL or service_booking: GST row applies to service checkout (existing behaviour). meal_plan_food: applies only to meal plan / meal order food pricing.';

-- At most one meal-plan-food row per catalogue category (optional; skip if not supported)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_tax_categories_catalog_meal_plan_food'
  ) THEN
    CREATE UNIQUE INDEX uq_tax_categories_catalog_meal_plan_food
      ON tax_categories (catalog_category_id)
      WHERE gst_application_scope = 'meal_plan_food' AND catalog_category_id IS NOT NULL;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Optional FK column on meal_plans: pin catalogue category for GST (defaults to Nutritionist resolution in code)
ALTER TABLE meal_plans
  ADD COLUMN IF NOT EXISTS service_catalog_category_id UUID REFERENCES service_categories(id) ON DELETE SET NULL;

COMMENT ON COLUMN meal_plans.service_catalog_category_id IS
  'When set, meal GST uses this service_categories row + tax_categories.gst_application_scope = meal_plan_food. When NULL, code falls back to Nutritionist master category.';
