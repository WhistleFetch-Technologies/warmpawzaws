/**
 * Schema for public.rescheduling_policies
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:21:05.668Z
 */

export const rescheduling_policiesSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (id IS NOT NULL)',
  policy_name: 'text NOT NULL UNIQUE CHECK (policy_name IS NOT NULL)',
  service_type: 'text',
  hours_before_booking: 'integer NOT NULL CHECK (hours_before_booking IS NOT NULL)',
  rescheduling_fee_percentage: 'numeric(5,2) DEFAULT 0',
  max_reschedules: 'integer DEFAULT 3',
  is_active: 'boolean DEFAULT true',
  created_at: 'timestamptz DEFAULT now()',
  updated_at: 'timestamptz DEFAULT now()'
};

/**
 * Indexes:
 * - rescheduling_policies_policy_name_key: CREATE UNIQUE INDEX rescheduling_policies_policy_name_key ON public.rescheduling_policies USING btree (policy_name)
 */

/**
 * Check Constraints:
 * - 2200_17813_2_not_null: policy_name IS NOT NULL
 * - 2200_17813_1_not_null: id IS NOT NULL
 * - 2200_17813_4_not_null: hours_before_booking IS NOT NULL
 */

