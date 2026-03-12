/**
 * Schema for public.product_policies
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:18:19.446Z
 */

export const product_policiesSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (product_id IS NOT NULL) CHECK (policy_id IS NOT NULL) CHECK (id IS NOT NULL)',
  product_id: 'uuid NOT NULL CHECK (product_id IS NOT NULL)', // REFERENCES products(id),
  policy_id: 'uuid NOT NULL CHECK (policy_id IS NOT NULL)', // REFERENCES ecommerce_policies(id),
  policy_type: 'text NOT NULL CHECK (policy_type IS NOT NULL)',
  created_at: 'timestamptz DEFAULT now()'
};

/**
 * Foreign Keys:
 * - product_id -> public.products.id
 * - policy_id -> public.ecommerce_policies.id
 */

/**
 * Unique Constraints:
 * - product_policies_product_id_policy_id_policy_type_key: (product_id, policy_id, policy_type)
 */

/**
 * Indexes:
 * - idx_product_policies_policy_id: CREATE INDEX idx_product_policies_policy_id ON public.product_policies USING btree (policy_id)
 * - idx_product_policies_product_id: CREATE INDEX idx_product_policies_product_id ON public.product_policies USING btree (product_id)
 * - product_policies_product_id_policy_id_policy_type_key: CREATE UNIQUE INDEX product_policies_product_id_policy_id_policy_type_key ON public.product_policies USING btree (product_id, policy_id, policy_type)
 */

/**
 * Check Constraints:
 * - 2200_20615_2_not_null: product_id IS NOT NULL
 * - 2200_20615_4_not_null: policy_type IS NOT NULL
 * - 2200_20615_3_not_null: policy_id IS NOT NULL
 * - 2200_20615_1_not_null: id IS NOT NULL
 */

