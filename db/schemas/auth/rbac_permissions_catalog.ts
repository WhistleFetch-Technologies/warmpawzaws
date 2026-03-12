/**
 * Schema for public.rbac_permissions_catalog
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:19:09.151Z
 */

export const rbac_permissions_catalogSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (id IS NOT NULL)',
  permission_key: 'text NOT NULL UNIQUE CHECK (permission_key IS NOT NULL)',
  permission_name: 'text NOT NULL CHECK (permission_name IS NOT NULL)',
  description: 'text',
  category: 'text NOT NULL CHECK (category IS NOT NULL)',
  resource: 'text',
  action: 'text',
  created_at: 'timestamptz DEFAULT now()'
};

/**
 * Indexes:
 * - idx_rbac_permissions_category: CREATE INDEX idx_rbac_permissions_category ON public.rbac_permissions_catalog USING btree (category)
 * - idx_rbac_permissions_key: CREATE INDEX idx_rbac_permissions_key ON public.rbac_permissions_catalog USING btree (permission_key)
 * - rbac_permissions_catalog_permission_key_key: CREATE UNIQUE INDEX rbac_permissions_catalog_permission_key_key ON public.rbac_permissions_catalog USING btree (permission_key)
 */

/**
 * Check Constraints:
 * - 2200_20211_3_not_null: permission_name IS NOT NULL
 * - 2200_20211_5_not_null: category IS NOT NULL
 * - 2200_20211_2_not_null: permission_key IS NOT NULL
 * - 2200_20211_1_not_null: id IS NOT NULL
 */

