-- Tag meal-plan delivery fee GST rows so checkout resolves delivery fee tax separately from food (meal_plan_food).

UPDATE tax_categories
SET gst_application_scope = 'meal_plan_delivery'
WHERE catalog_category_id IS NOT NULL
  AND gst_application_scope IS DISTINCT FROM 'meal_plan_delivery'
  AND gst_application_scope IS DISTINCT FROM 'meal_plan_food'
  AND (
    LOWER(TRIM(category_name)) LIKE '%meal plan%delivery%'
    OR LOWER(TRIM(name)) LIKE '%meal plan%delivery%'
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_tax_categories_catalog_meal_plan_delivery
  ON tax_categories (catalog_category_id)
  WHERE gst_application_scope = 'meal_plan_delivery' AND catalog_category_id IS NOT NULL;

COMMENT ON COLUMN tax_categories.gst_application_scope IS
  'service_booking | meal_plan_food | meal_plan_delivery — scopes GST rows for services vs meal food vs meal delivery fee.';
