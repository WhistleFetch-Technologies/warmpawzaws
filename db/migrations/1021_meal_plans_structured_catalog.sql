-- Structured meal product catalog columns (vendor Add meal product).
-- Safe to re-run (IF NOT EXISTS). Run via scripts/run-migration-via-rds-data-api.js

ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS pack_weight_grams INTEGER;
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS meals_per_delivery INTEGER;
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS delivery_days TEXT[];
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS delivery_frequency TEXT;
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS subscription_price NUMERIC(12, 2);
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS recommended_plan_weeks INTEGER;
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS preparation_type TEXT;
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS diet_type VARCHAR(50);
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS pet_types TEXT[];
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS meal_categories TEXT[];
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS medical_condition_tags TEXT[];
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS meal_image_url TEXT;

COMMENT ON COLUMN meal_plans.pack_weight_grams IS 'Per-pack weight in grams (Pidge / courier)';
COMMENT ON COLUMN meal_plans.meals_per_delivery IS 'WEEKLY_PLAN only: meals per delivery drop';
COMMENT ON COLUMN meal_plans.delivery_days IS 'WEEKLY_PLAN only: MONDAY..SUNDAY';
COMMENT ON COLUMN meal_plans.delivery_frequency IS 'MONTHLY_PLAN only: DAILY|ALTERNATE_DAYS|TWICE_WEEKLY|WEEKLY';
UPDATE meal_plans mp
SET
  pack_weight_grams = COALESCE(
    mp.pack_weight_grams,
    NULLIF((mp.dietary_requirements->>'packWeightGrams')::int, 0),
    NULLIF((mp.dietary_requirements->>'pack_weight_grams')::int, 0)
  ),
  preparation_type = COALESCE(mp.preparation_type, mp.dietary_requirements->>'preparationType'),
  meal_image_url = COALESCE(mp.meal_image_url, mp.dietary_requirements->>'mealImageUrl'),
  subscription_price = COALESCE(
    mp.subscription_price,
    NULLIF((mp.dietary_requirements->>'subscriptionPrice')::numeric, 0)
  ),
  recommended_plan_weeks = COALESCE(
    mp.recommended_plan_weeks,
    NULLIF((mp.dietary_requirements->>'recommendedPlanLengthWeeks')::int, 0)
  ),
  delivery_frequency = COALESCE(mp.delivery_frequency, mp.dietary_requirements->>'deliveryFrequency')
WHERE mp.dietary_requirements IS NOT NULL;

UPDATE meal_plans mp
SET delivery_days = COALESCE(
  mp.delivery_days,
  ARRAY(SELECT jsonb_array_elements_text(mp.dietary_requirements->'deliveryDays'))
)
WHERE mp.delivery_days IS NULL
  AND jsonb_typeof(mp.dietary_requirements->'deliveryDays') = 'array'
  AND mp.dietary_requirements->>'purchaseType' = 'WEEKLY_PLAN';

UPDATE meal_plans mp
SET meals_per_delivery = COALESCE(
  mp.meals_per_delivery,
  NULLIF((mp.dietary_requirements->>'mealsPerDelivery')::int, 0)
)
WHERE mp.dietary_requirements->>'purchaseType' = 'WEEKLY_PLAN'
  AND mp.meals_per_delivery IS NULL;
