/**
 * Schema for public.refund_rules
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:19:49.056Z
 */

export const refund_rulesSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (id IS NOT NULL)',
  name: 'text NOT NULL CHECK (name IS NOT NULL)',
  description: 'text',
  rule_type: 'text NOT NULL CHECK (((rule_type = ANY (ARRAY['time_based'::text, 'status_based'::text, 'amount_based'::text, 'custom'::text])))) CHECK (rule_type IS NOT NULL)',
  rule_config: 'jsonb NOT NULL CHECK (rule_config IS NOT NULL)',
  is_active: 'boolean DEFAULT true',
  created_at: 'timestamptz DEFAULT now()',
  updated_at: 'timestamptz DEFAULT now()'
};

/**
 * Check Constraints:
 * - refund_rules_rule_type_check: ((rule_type = ANY (ARRAY['time_based'::text, 'status_based'::text, 'amount_based'::text, 'custom'::text])))
 * - 2200_16722_2_not_null: name IS NOT NULL
 * - 2200_16722_4_not_null: rule_type IS NOT NULL
 * - 2200_16722_5_not_null: rule_config IS NOT NULL
 * - 2200_16722_1_not_null: id IS NOT NULL
 */

