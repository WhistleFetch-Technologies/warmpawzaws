-- ============================================================================
-- MIGRATION 562: Add allowed_service_styles to problem_grid_mappings (Production Fix)
-- ============================================================================
-- Purpose: Ensure allowed_service_styles column exists in problem_grid_mappings
--          This column is required by /customer/services/by-problem endpoint
-- Date: 2026-02-21
-- ============================================================================

BEGIN;

-- Add allowed_service_styles column with default for all three styles
-- Using IF NOT EXISTS to make it idempotent
ALTER TABLE problem_grid_mappings
ADD COLUMN IF NOT EXISTS allowed_service_styles JSONB DEFAULT '["at_home", "at_center", "tele"]'::jsonb;

-- Add comment explaining the column
COMMENT ON COLUMN problem_grid_mappings.allowed_service_styles IS 
  'JSON array specifying which service styles are valid for this problem. Values: at_home, at_center, tele';

-- Create index for efficient querying by service style (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_problem_grid_allowed_styles 
  ON problem_grid_mappings USING GIN (allowed_service_styles);

-- Update any NULL values to have the default
UPDATE problem_grid_mappings
SET allowed_service_styles = '["at_home", "at_center", "tele"]'::jsonb
WHERE allowed_service_styles IS NULL;

COMMIT;
