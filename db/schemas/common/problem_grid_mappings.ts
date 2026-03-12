/**
 * Schema for public.problem_grid_mappings
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:18:06.596Z
 */

export const problem_grid_mappingsSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (role_id IS NOT NULL) CHECK (sub_category_id IS NOT NULL) CHECK (problem_id IS NOT NULL) CHECK (id IS NOT NULL)',
  problem_id: 'text NOT NULL CHECK (problem_id IS NOT NULL)',
  problem_name: 'text NOT NULL CHECK (problem_name IS NOT NULL)',
  problem_display_name: 'text',
  role_id: 'text NOT NULL CHECK (role_id IS NOT NULL)',
  sub_category_id: 'text NOT NULL CHECK (sub_category_id IS NOT NULL)',
  sub_category_name: 'text',
  order_index: 'integer DEFAULT 0',
  created_at: 'timestamptz DEFAULT now()',
  updated_at: 'timestamptz DEFAULT now()',
  allowed_service_styles: 'jsonb DEFAULT '["at_home", "at_center", "tele"]''
};

/**
 * Unique Constraints:
 * - problem_grid_mappings_problem_id_sub_category_id_key: (problem_id, sub_category_id)
 */

/**
 * Indexes:
 * - idx_problem_grid_allowed_styles: CREATE INDEX idx_problem_grid_allowed_styles ON public.problem_grid_mappings USING gin (allowed_service_styles)
 * - idx_problem_grid_mappings_problem_id: CREATE INDEX idx_problem_grid_mappings_problem_id ON public.problem_grid_mappings USING btree (problem_id)
 * - idx_problem_grid_mappings_role_id: CREATE INDEX idx_problem_grid_mappings_role_id ON public.problem_grid_mappings USING btree (role_id)
 * - idx_problem_grid_mappings_sub_category: CREATE INDEX idx_problem_grid_mappings_sub_category ON public.problem_grid_mappings USING btree (sub_category_id)
 * - problem_grid_mappings_problem_id_sub_category_id_key: CREATE UNIQUE INDEX problem_grid_mappings_problem_id_sub_category_id_key ON public.problem_grid_mappings USING btree (problem_id, sub_category_id)
 */

/**
 * Check Constraints:
 * - 2200_29098_5_not_null: role_id IS NOT NULL
 * - 2200_29098_3_not_null: problem_name IS NOT NULL
 * - 2200_29098_6_not_null: sub_category_id IS NOT NULL
 * - 2200_29098_2_not_null: problem_id IS NOT NULL
 * - 2200_29098_1_not_null: id IS NOT NULL
 */

