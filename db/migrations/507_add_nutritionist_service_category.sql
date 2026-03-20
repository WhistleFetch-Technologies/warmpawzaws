-- ============================================================================
-- MIGRATION 507: Add Nutritionist to service_categories (customer-web tile)
-- ============================================================================
-- Purpose: Customer web shows tiles from service_categories. Only "wellness"
-- (Wellness & Nutrition) existed; "Nutritionist" (category + specialization)
-- was missing. Dashboard launch config has both "wellness" and "nutritionist";
-- when user enables "Nutritionist", the tile must appear. Adding this row
-- ensures GET /service-catalog/categories returns a category with
-- category_id 'nutritionist' and name 'Nutritionist'.
-- ============================================================================

INSERT INTO service_categories (category_id, name, description, icon, icon_color, display_order, is_active)
VALUES (
  'nutritionist',
  'Nutritionist',
  'Pet nutrition consultation and diet planning (category with specialization)',
  'Wheat',
  'text-green-600',
  9,
  true
)
ON CONFLICT (category_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = COALESCE(service_categories.icon, EXCLUDED.icon),
  icon_color = COALESCE(service_categories.icon_color, EXCLUDED.icon_color),
  display_order = COALESCE(service_categories.display_order, EXCLUDED.display_order),
  is_active = true,
  updated_at = NOW();
