/**
 * Schema for public.scheduling_policies
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:22:42.623Z
 */

export const scheduling_policiesSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (id IS NOT NULL)',
  policy_name: 'text NOT NULL UNIQUE CHECK (policy_name IS NOT NULL)',
  policy_type: 'text NOT NULL CHECK (policy_type IS NOT NULL) CHECK (((policy_type = ANY (ARRAY['booking_capacity'::text, 'slot_reservation'::text, 'emergency_priority'::text, 'subscription_slot'::text, 'package_session'::text, 'commute_time'::text, 'buffer_time'::text, 'overbooking_prevention'::text, 'ghost_availability'::text, 'multi_location_travel'::text, 'subscription_recurrence'::text, 'package_booking'::text]))))',
  policy_config: 'jsonb NOT NULL CHECK (policy_config IS NOT NULL)',
  is_active: 'boolean DEFAULT true',
  created_at: 'timestamptz DEFAULT now()',
  updated_at: 'timestamptz DEFAULT now()'
};

/**
 * Indexes:
 * - idx_scheduling_policies_active: CREATE INDEX idx_scheduling_policies_active ON public.scheduling_policies USING btree (is_active) WHERE (is_active = true)
 * - scheduling_policies_policy_name_key: CREATE UNIQUE INDEX scheduling_policies_policy_name_key ON public.scheduling_policies USING btree (policy_name)
 */

/**
 * Check Constraints:
 * - 2200_29083_2_not_null: policy_name IS NOT NULL
 * - 2200_29083_3_not_null: policy_type IS NOT NULL
 * - 2200_29083_4_not_null: policy_config IS NOT NULL
 * - scheduling_policies_policy_type_check: ((policy_type = ANY (ARRAY['booking_capacity'::text, 'slot_reservation'::text, 'emergency_priority'::text, 'subscription_slot'::text, 'package_session'::text, 'commute_time'::text, 'buffer_time'::text, 'overbooking_prevention'::text, 'ghost_availability'::text, 'multi_location_travel'::text, 'subscription_recurrence'::text, 'package_booking'::text])))
 * - 2200_29083_1_not_null: id IS NOT NULL
 */

