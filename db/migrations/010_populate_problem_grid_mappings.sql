-- ============================================================================
-- MIGRATION 010: Populate Problem Grid Mappings
-- ============================================================================
-- Purpose: Populate problem_grid_mappings table from problem grid catalog
-- Date: 2025-01-27
-- ============================================================================

-- Clear existing mappings (will be repopulated)
TRUNCATE TABLE problem_grid_mappings;

-- Function to insert problem grid mappings
-- This will be called from application code to populate from catalog
CREATE OR REPLACE FUNCTION populate_problem_grid_mapping(
  p_problem_id TEXT,
  p_problem_name TEXT,
  p_problem_display_name TEXT,
  p_role_id TEXT,
  p_sub_category_id TEXT,
  p_sub_category_name TEXT,
  p_order_index INTEGER DEFAULT 0
)
RETURNS void AS $$
BEGIN
  INSERT INTO problem_grid_mappings (
    problem_id,
    problem_name,
    problem_display_name,
    role_id,
    sub_category_id,
    sub_category_name,
    order_index,
    created_at,
    updated_at
  )
  VALUES (
    p_problem_id,
    p_problem_name,
    p_problem_display_name,
    p_role_id,
    p_sub_category_id,
    p_sub_category_name,
    p_order_index,
    NOW(),
    NOW()
  )
  ON CONFLICT (problem_id, sub_category_id)
  DO UPDATE SET
    problem_name = EXCLUDED.problem_name,
    problem_display_name = EXCLUDED.problem_display_name,
    role_id = EXCLUDED.role_id,
    sub_category_name = EXCLUDED.sub_category_name,
    order_index = EXCLUDED.order_index,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION populate_problem_grid_mapping IS 'Populates problem grid mappings from catalog';

