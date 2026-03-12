/**
 * Schema for public.search_analytics
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:22:56.902Z
 */

export const search_analyticsSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (id IS NOT NULL)',
  search_date: 'date NOT NULL CHECK (search_date IS NOT NULL)',
  query: 'text NOT NULL CHECK (query IS NOT NULL)',
  results_count: 'integer DEFAULT 0',
  zero_results: 'boolean DEFAULT false',
  created_at: 'timestamptz DEFAULT now()'
};

/**
 * Unique Constraints:
 * - search_analytics_search_date_query_key: (search_date, query)
 */

/**
 * Indexes:
 * - search_analytics_search_date_query_key: CREATE UNIQUE INDEX search_analytics_search_date_query_key ON public.search_analytics USING btree (search_date, query)
 */

/**
 * Check Constraints:
 * - 2200_17099_3_not_null: query IS NOT NULL
 * - 2200_17099_1_not_null: id IS NOT NULL
 * - 2200_17099_2_not_null: search_date IS NOT NULL
 */

