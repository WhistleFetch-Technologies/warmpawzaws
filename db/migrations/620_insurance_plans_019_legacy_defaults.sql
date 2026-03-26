-- ============================================================================
-- MIGRATION 620: insurance_plans legacy 019 NOT NULL safety nets
-- ============================================================================
-- If INSERT omits provider / plan_type / coverage / monthly_premium /
-- annual_premium (older Lambda builds), PostgreSQL can use these defaults.
-- plan_type must stay within 019 CHECK: accident_only, time_limited,
-- maximum_benefit, lifetime
-- ============================================================================

ALTER TABLE insurance_plans ALTER COLUMN provider SET DEFAULT 'Vendor';
ALTER TABLE insurance_plans ALTER COLUMN plan_type SET DEFAULT 'lifetime';
ALTER TABLE insurance_plans ALTER COLUMN coverage SET DEFAULT '{}'::jsonb;
ALTER TABLE insurance_plans ALTER COLUMN monthly_premium SET DEFAULT 0;
ALTER TABLE insurance_plans ALTER COLUMN annual_premium SET DEFAULT 0;
