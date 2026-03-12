/**
 * Schema for public.search_history
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:23:14.882Z
 */

export const search_historySchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (id IS NOT NULL)',
  customer_id: 'uuid', // REFERENCES customers(id),
  search_query: 'text NOT NULL CHECK (search_query IS NOT NULL)',
  results_count: 'integer DEFAULT 0',
  clicked_result_id: 'uuid',
  created_at: 'timestamptz DEFAULT now()'
};

/**
 * Foreign Keys:
 * - customer_id -> public.customers.id
 */

/**
 * Check Constraints:
 * - 2200_17089_3_not_null: search_query IS NOT NULL
 * - 2200_17089_1_not_null: id IS NOT NULL
 */

