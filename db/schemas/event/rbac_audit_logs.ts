/**
 * Schema for public.rbac_audit_logs
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:18:56.691Z
 */

export const rbac_audit_logsSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (user_id IS NOT NULL) CHECK (id IS NOT NULL)',
  action: 'text NOT NULL CHECK (action IS NOT NULL)',
  user_id: 'uuid NOT NULL CHECK (user_id IS NOT NULL)',
  target_user_id: 'uuid',
  role_id: 'uuid', // REFERENCES roles(id),
  permission_name: 'text',
  details: 'jsonb',
  ip_address: 'text',
  user_agent: 'text',
  created_at: 'timestamptz DEFAULT now()'
};

/**
 * Foreign Keys:
 * - role_id -> public.roles.id
 */

/**
 * Indexes:
 * - idx_rbac_audit_action: CREATE INDEX idx_rbac_audit_action ON public.rbac_audit_logs USING btree (action)
 * - idx_rbac_audit_created: CREATE INDEX idx_rbac_audit_created ON public.rbac_audit_logs USING btree (created_at DESC)
 * - idx_rbac_audit_target: CREATE INDEX idx_rbac_audit_target ON public.rbac_audit_logs USING btree (target_user_id)
 * - idx_rbac_audit_user: CREATE INDEX idx_rbac_audit_user ON public.rbac_audit_logs USING btree (user_id)
 */

/**
 * Check Constraints:
 * - 2200_20193_3_not_null: user_id IS NOT NULL
 * - 2200_20193_2_not_null: action IS NOT NULL
 * - 2200_20193_1_not_null: id IS NOT NULL
 */

