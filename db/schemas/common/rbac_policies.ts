/**
 * Schema for public.rbac_policies
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:19:22.564Z
 */

export const rbac_policiesSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (policy_id IS NOT NULL) CHECK (id IS NOT NULL)',
  policy_id: 'text NOT NULL UNIQUE CHECK (policy_id IS NOT NULL)',
  name: 'text NOT NULL CHECK (name IS NOT NULL)',
  description: 'text',
  rules: 'jsonb NOT NULL CHECK (rules IS NOT NULL)',
  effect: 'text NOT NULL DEFAULT 'allow' CHECK (((effect = ANY (ARRAY['allow'::text, 'deny'::text])))) CHECK (effect IS NOT NULL)',
  priority: 'integer DEFAULT 0',
  is_active: 'boolean DEFAULT true',
  created_at: 'timestamptz DEFAULT now()',
  updated_at: 'timestamptz DEFAULT now()'
};

/**
 * Indexes:
 * - idx_rbac_policies_active: CREATE INDEX idx_rbac_policies_active ON public.rbac_policies USING btree (is_active)
 * - idx_rbac_policies_policy_id: CREATE INDEX idx_rbac_policies_policy_id ON public.rbac_policies USING btree (policy_id)
 * - idx_rbac_policies_priority: CREATE INDEX idx_rbac_policies_priority ON public.rbac_policies USING btree (priority DESC)
 * - rbac_policies_policy_id_key: CREATE UNIQUE INDEX rbac_policies_policy_id_key ON public.rbac_policies USING btree (policy_id)
 */

/**
 * Check Constraints:
 * - 2200_19733_2_not_null: policy_id IS NOT NULL
 * - rbac_policies_effect_check: ((effect = ANY (ARRAY['allow'::text, 'deny'::text])))
 * - 2200_19733_5_not_null: rules IS NOT NULL
 * - 2200_19733_3_not_null: name IS NOT NULL
 * - 2200_19733_1_not_null: id IS NOT NULL
 * - 2200_19733_6_not_null: effect IS NOT NULL
 */

