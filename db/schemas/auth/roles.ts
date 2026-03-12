/**
 * Schema for public.roles
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:21:59.632Z
 */

export const rolesSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (id IS NOT NULL)',
  name: 'text NOT NULL UNIQUE CHECK (display_name IS NOT NULL) CHECK (name IS NOT NULL)',
  display_name: 'text NOT NULL CHECK (display_name IS NOT NULL)',
  description: 'text',
  is_system_role: 'boolean DEFAULT false',
  is_active: 'boolean DEFAULT true',
  created_at: 'timestamptz DEFAULT now()',
  updated_at: 'timestamptz DEFAULT now()',
  config: 'jsonb DEFAULT '{}'',
  role_type: 'text DEFAULT 'vendor''
};

/**
 * Indexes:
 * - idx_roles_config: CREATE INDEX idx_roles_config ON public.roles USING gin (config)
 * - roles_name_key: CREATE UNIQUE INDEX roles_name_key ON public.roles USING btree (name)
 */

/**
 * Check Constraints:
 * - 2200_16876_3_not_null: display_name IS NOT NULL
 * - 2200_16876_1_not_null: id IS NOT NULL
 * - 2200_16876_2_not_null: name IS NOT NULL
 */

