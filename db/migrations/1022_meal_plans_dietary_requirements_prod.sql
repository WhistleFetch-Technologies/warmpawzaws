-- meal_plans schema alignment for vendor meal-products API (PUT/POST uses dietary_requirements + catalog columns).
-- Safe to re-run (IF NOT EXISTS). Prod was missing dietary_requirements, duration_days, meals_per_day, etc.

ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS dietary_requirements JSONB DEFAULT '{}'::jsonb;
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS duration_days INTEGER;
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS meals_per_day INTEGER;

ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS purchase_type TEXT;
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS subscription_config JSONB;

ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS pack_weight_grams INTEGER;
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS meals_per_delivery INTEGER;
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS delivery_days TEXT[];
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS delivery_frequency TEXT;
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS subscription_price NUMERIC(12, 2);
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS recommended_plan_weeks INTEGER;
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS preparation_type TEXT;
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS pet_types TEXT[];
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS meal_categories TEXT[];
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS medical_condition_tags TEXT[];
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS meal_image_url TEXT;

COMMENT ON COLUMN meal_plans.dietary_requirements IS
  'Meal catalog JSON: petTypes, dietType, purchaseType, mealImageUrl, ingredients, subscriptionConfig, etc.';

CREATE INDEX IF NOT EXISTS idx_meal_plans_dietary_requirements_gin ON meal_plans USING GIN (dietary_requirements);
