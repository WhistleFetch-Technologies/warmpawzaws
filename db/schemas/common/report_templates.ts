/**
 * Schema for public.report_templates
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:20:53.179Z
 */

export const report_templatesSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (id IS NOT NULL)',
  name: 'text NOT NULL CHECK (name IS NOT NULL)',
  description: 'text',
  category: 'text CHECK (((category = ANY (ARRAY['financial'::text, 'operational'::text, 'vendor'::text, 'customer'::text, 'custom'::text]))))',
  parameters: 'jsonb DEFAULT '[]'',
  schedule: 'jsonb',
  last_generated: 'timestamptz',
  created_at: 'timestamptz DEFAULT now()',
  updated_at: 'timestamptz DEFAULT now()'
};

/**
 * Indexes:
 * - idx_report_templates_category: CREATE INDEX idx_report_templates_category ON public.report_templates USING btree (category)
 */

/**
 * Check Constraints:
 * - 2200_29053_1_not_null: id IS NOT NULL
 * - 2200_29053_2_not_null: name IS NOT NULL
 * - report_templates_category_check: ((category = ANY (ARRAY['financial'::text, 'operational'::text, 'vendor'::text, 'customer'::text, 'custom'::text])))
 */

