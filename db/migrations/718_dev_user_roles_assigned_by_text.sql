-- ============================================================================
-- MIGRATION 718 (DEV RDS ONLY): user_roles.assigned_by UUID → TEXT
-- ============================================================================
-- Allows synthetic assigner ids (e.g. uat-admin-user) from UAT auth middleware.
-- Run ONLY on dev / non-prod RDS — do not run on prod if you rely on UUID FKs.
-- ============================================================================

ALTER TABLE public.user_roles
  ALTER COLUMN assigned_by TYPE TEXT USING assigned_by::text;

COMMENT ON COLUMN public.user_roles.assigned_by IS 'Admin or actor who assigned the role (UUID string or UAT synthetic id)';
