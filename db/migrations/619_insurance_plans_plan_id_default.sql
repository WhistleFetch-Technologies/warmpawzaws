-- ============================================================================
-- MIGRATION 619: Legacy insurance_plans.plan_id (TEXT NOT NULL) default
-- ============================================================================
-- Migration 019 required plan_id on every row. Vendor API inserts often omit it
-- (UUID primary key is `id`). Older deployed Lambdas still omit plan_id.
-- This DEFAULT lets INSERT succeed without that column in the statement.
-- ============================================================================

ALTER TABLE insurance_plans
  ALTER COLUMN plan_id SET DEFAULT gen_random_uuid()::text;
