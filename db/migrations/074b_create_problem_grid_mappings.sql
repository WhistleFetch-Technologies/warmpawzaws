-- Migration: Create problem_grid_mappings table
-- Purpose: Fix missing table causing API errors
-- Date: 2026-01-19

BEGIN;

-- Create problem_grid_mappings table
CREATE TABLE IF NOT EXISTS problem_grid_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_id TEXT NOT NULL,
    problem_name TEXT NOT NULL,
    problem_display_name TEXT,
    role_id TEXT NOT NULL,
    sub_category_id TEXT NOT NULL,
    sub_category_name TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(problem_id, sub_category_id)
);

CREATE INDEX IF NOT EXISTS idx_problem_grid_mappings_problem_id ON problem_grid_mappings(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_grid_mappings_role_id ON problem_grid_mappings(role_id);
CREATE INDEX IF NOT EXISTS idx_problem_grid_mappings_sub_category ON problem_grid_mappings(sub_category_id);

COMMENT ON TABLE problem_grid_mappings IS 'Stores problem grid to subcategory mappings for service discovery';

-- Verify table created
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'problem_grid_mappings'
    ) THEN
        RAISE EXCEPTION 'problem_grid_mappings table not created';
    END IF;
    
    RAISE NOTICE '✅ problem_grid_mappings table created successfully';
END $$;

COMMIT;
