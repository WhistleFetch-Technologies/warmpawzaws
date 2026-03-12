/**
 * Schema for public.service_categories
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:24:10.278Z
 */

export const service_categoriesSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (id IS NOT NULL)',
  name: 'text NOT NULL UNIQUE CHECK (name IS NOT NULL)',
  description: 'text',
  display_order: 'integer DEFAULT 0',
  created_at: 'timestamptz DEFAULT now()',
  category_id: 'text UNIQUE',
  is_active: 'boolean DEFAULT true',
  icon: 'text',
  icon_color: 'text',
  updated_at: 'timestamptz DEFAULT now()'
};

/**
 * Indexes:
 * - idx_service_categories_active: CREATE INDEX idx_service_categories_active ON public.service_categories USING btree (is_active) WHERE (is_active IS NOT NULL)
 * - idx_service_categories_category_id: CREATE INDEX idx_service_categories_category_id ON public.service_categories USING btree (category_id) WHERE (category_id IS NOT NULL)
 * - idx_service_categories_display_order: CREATE INDEX idx_service_categories_display_order ON public.service_categories USING btree (display_order)
 * - idx_service_categories_name: CREATE INDEX idx_service_categories_name ON public.service_categories USING btree (name)
 * - service_categories_category_id_key: CREATE UNIQUE INDEX service_categories_category_id_key ON public.service_categories USING btree (category_id)
 * - service_categories_name_key: CREATE UNIQUE INDEX service_categories_name_key ON public.service_categories USING btree (name)
 */

/**
 * Check Constraints:
 * - 2200_16616_1_not_null: id IS NOT NULL
 * - 2200_16616_2_not_null: name IS NOT NULL
 */

