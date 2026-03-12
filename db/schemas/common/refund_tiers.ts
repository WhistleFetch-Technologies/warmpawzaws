/**
 * Schema for public.refund_tiers
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:20:01.816Z
 */

export const refund_tiersSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (id IS NOT NULL)',
  tier_name: 'text NOT NULL UNIQUE CHECK (tier_name IS NOT NULL)',
  min_hours_before_booking: 'integer',
  refund_percentage: 'numeric(5,2) NOT NULL CHECK (refund_percentage IS NOT NULL) CHECK ((((refund_percentage >= (0)::numeric) AND (refund_percentage <= (100)::numeric))))',
  is_active: 'boolean DEFAULT true',
  created_at: 'timestamptz DEFAULT now()'
};

/**
 * Indexes:
 * - refund_tiers_tier_name_key: CREATE UNIQUE INDEX refund_tiers_tier_name_key ON public.refund_tiers USING btree (tier_name)
 */

/**
 * Check Constraints:
 * - 2200_16734_4_not_null: refund_percentage IS NOT NULL
 * - 2200_16734_2_not_null: tier_name IS NOT NULL
 * - refund_tiers_refund_percentage_check: (((refund_percentage >= (0)::numeric) AND (refund_percentage <= (100)::numeric)))
 * - 2200_16734_1_not_null: id IS NOT NULL
 */

