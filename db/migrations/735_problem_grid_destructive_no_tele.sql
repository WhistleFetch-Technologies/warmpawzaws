-- ============================================================================
-- MIGRATION 735: Destructive Behavior problem — no video (tele) delivery
-- ============================================================================
-- Aligns DB with product rule: destructive-habits sessions are in-person only.
-- ============================================================================

BEGIN;

UPDATE problem_grid_mappings
SET allowed_service_styles = '["at_home", "at_center"]'::jsonb
WHERE problem_id = 'destructive';

COMMIT;
