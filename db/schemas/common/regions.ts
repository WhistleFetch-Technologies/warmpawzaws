/**
 * Schema for public.regions
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:20:27.104Z
 */

export const regionsSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (id IS NOT NULL)',
  name: 'text NOT NULL UNIQUE CHECK (name IS NOT NULL)',
  code: 'text NOT NULL UNIQUE CHECK (code IS NOT NULL)',
  country: 'text DEFAULT 'India'',
  region_config: 'jsonb',
  is_active: 'boolean DEFAULT true',
  created_at: 'timestamptz DEFAULT now()',
  updated_at: 'timestamptz DEFAULT now()'
};

/**
 * Indexes:
 * - regions_code_key: CREATE UNIQUE INDEX regions_code_key ON public.regions USING btree (code)
 * - regions_name_key: CREATE UNIQUE INDEX regions_name_key ON public.regions USING btree (name)
 */

/**
 * Check Constraints:
 * - 2200_17062_1_not_null: id IS NOT NULL
 * - 2200_17062_2_not_null: name IS NOT NULL
 * - 2200_17062_3_not_null: code IS NOT NULL
 */

