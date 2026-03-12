/**
 * Schema for public.search_index
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:23:35.594Z
 */

export const search_indexSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (entity_id IS NOT NULL) CHECK (id IS NOT NULL)',
  entity_type: 'text NOT NULL CHECK (entity_type IS NOT NULL)',
  entity_id: 'uuid NOT NULL CHECK (entity_id IS NOT NULL)',
  search_text: 'text NOT NULL CHECK (search_text IS NOT NULL)',
  search_vector: 'tsvector',
  metadata: 'jsonb',
  created_at: 'timestamptz DEFAULT now()',
  updated_at: 'timestamptz DEFAULT now()'
};

/**
 * Check Constraints:
 * - 2200_17078_2_not_null: entity_type IS NOT NULL
 * - 2200_17078_3_not_null: entity_id IS NOT NULL
 * - 2200_17078_1_not_null: id IS NOT NULL
 * - 2200_17078_4_not_null: search_text IS NOT NULL
 */

