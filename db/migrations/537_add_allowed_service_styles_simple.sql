-- ============================================================================
-- MIGRATION 537: Add allowed_service_styles to problem_grid_mappings (Simple)
-- ============================================================================
-- Purpose: Add allowed_service_styles column to specify which service styles
--          are valid for each problem (at_home, at_center, tele)
-- Date: 2026-02-21
-- ============================================================================

BEGIN;

-- Add allowed_service_styles column with default for all three styles
ALTER TABLE problem_grid_mappings
ADD COLUMN IF NOT EXISTS allowed_service_styles JSONB DEFAULT '["at_home", "at_center", "tele"]'::jsonb;

-- Add comment explaining the column
COMMENT ON COLUMN problem_grid_mappings.allowed_service_styles IS 
  'JSON array specifying which service styles are valid for this problem. Values: at_home, at_center, tele';

-- Create index for efficient querying by service style
CREATE INDEX IF NOT EXISTS idx_problem_grid_allowed_styles 
  ON problem_grid_mappings USING GIN (allowed_service_styles);

COMMIT;
