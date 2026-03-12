/**
 * Schema for public.service_style_mappings
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:24:41.459Z
 */

export const service_style_mappingsSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (id IS NOT NULL)',
  legacy_name: 'text NOT NULL UNIQUE CHECK (legacy_name IS NOT NULL)',
  standard_name: 'text NOT NULL CHECK (((standard_name = ANY (ARRAY['at_center'::text, 'at_home'::text, 'tele'::text])))) CHECK (standard_name IS NOT NULL)',
  description: 'text',
  created_at: 'timestamptz DEFAULT now()'
};

/**
 * Indexes:
 * - service_style_mappings_legacy_name_key: CREATE UNIQUE INDEX service_style_mappings_legacy_name_key ON public.service_style_mappings USING btree (legacy_name)
 */

/**
 * Check Constraints:
 * - 2200_17791_1_not_null: id IS NOT NULL
 * - 2200_17791_2_not_null: legacy_name IS NOT NULL
 * - service_style_mappings_standard_name_check: ((standard_name = ANY (ARRAY['at_center'::text, 'at_home'::text, 'tele'::text])))
 * - 2200_17791_3_not_null: standard_name IS NOT NULL
 */

