-- Meal product catalog extensions (vendor nutritionist UI + API).
-- Canonical values live in JSON: meal_plans.dietary_requirements, products.metadata / specifications.
-- See backend constants: backend/lambda/src/constants/meal-product-enums.ts

COMMENT ON COLUMN meal_plans.dietary_requirements IS
  'Meal catalog JSON: petTypes, dietType, suitableFor, ingredients (string[]), nutritionalValue, preparationLeadTime, mealImageUrl, mealCategories[], medicalConditionTags[], feedingInstructions, storageInstructions, shelfLifeDays, deliveryType, mealsPerDayPreset, mealsPerDayCustom, allergens[], preparationType, mealsPerDay (int mirror).';

CREATE INDEX IF NOT EXISTS idx_meal_plans_dietary_requirements_gin ON meal_plans USING GIN (dietary_requirements);
