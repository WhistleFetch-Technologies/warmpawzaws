/**
 * Schema for public.role_permissions
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:21:43.968Z
 */

export const role_permissionsSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (role_id IS NOT NULL) CHECK (id IS NOT NULL)',
  role_id: 'uuid NOT NULL CHECK (role_id IS NOT NULL)', // REFERENCES roles(id),
  permission_name: 'text NOT NULL CHECK (permission_name IS NOT NULL)',
  resource: 'text NOT NULL CHECK (resource IS NOT NULL)',
  action: 'text NOT NULL CHECK (action IS NOT NULL)',
  created_at: 'timestamptz DEFAULT now()'
};

/**
 * Foreign Keys:
 * - role_id -> public.roles.id
 */

/**
 * Unique Constraints:
 * - role_permissions_role_id_permission_name_resource_action_key: (role_id, permission_name, resource, action)
 */

/**
 * Indexes:
 * - idx_role_permissions_permission: CREATE INDEX idx_role_permissions_permission ON public.role_permissions USING btree (permission_name)
 * - idx_role_permissions_role: CREATE INDEX idx_role_permissions_role ON public.role_permissions USING btree (role_id)
 * - role_permissions_role_id_permission_name_resource_action_key: CREATE UNIQUE INDEX role_permissions_role_id_permission_name_resource_action_key ON public.role_permissions USING btree (role_id, permission_name, resource, action)
 */

/**
 * Check Constraints:
 * - 2200_16890_5_not_null: action IS NOT NULL
 * - 2200_16890_2_not_null: role_id IS NOT NULL
 * - 2200_16890_3_not_null: permission_name IS NOT NULL
 * - 2200_16890_1_not_null: id IS NOT NULL
 * - 2200_16890_4_not_null: resource IS NOT NULL
 */

