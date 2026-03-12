/**
 * Schema for public.referrals
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:19:36.414Z
 */

export const referralsSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (referrer_id IS NOT NULL) CHECK (id IS NOT NULL)',
  referrer_id: 'uuid NOT NULL CHECK (referrer_id IS NOT NULL)', // REFERENCES customers(id),
  referred_id: 'uuid', // REFERENCES customers(id),
  referral_code: 'text NOT NULL UNIQUE CHECK (referral_code IS NOT NULL)',
  status: 'text DEFAULT 'pending' CHECK (((status = ANY (ARRAY['pending'::text, 'completed'::text, 'expired'::text]))))',
  reward_points: 'integer DEFAULT 0',
  completed_at: 'timestamptz',
  expires_at: 'timestamptz',
  created_at: 'timestamptz DEFAULT now()'
};

/**
 * Foreign Keys:
 * - referrer_id -> public.customers.id
 * - referred_id -> public.customers.id
 */

/**
 * Indexes:
 * - referrals_referral_code_key: CREATE UNIQUE INDEX referrals_referral_code_key ON public.referrals USING btree (referral_code)
 */

/**
 * Check Constraints:
 * - 2200_17337_4_not_null: referral_code IS NOT NULL
 * - 2200_17337_2_not_null: referrer_id IS NOT NULL
 * - referrals_status_check: ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'expired'::text])))
 * - 2200_17337_1_not_null: id IS NOT NULL
 */

