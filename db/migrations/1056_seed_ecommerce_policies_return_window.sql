-- Migration: 1056_seed_ecommerce_policies_return_window.sql
-- Ensures ecommerce_policies has at least one row with a non-null return_window_days
-- so the backend has a platform-level default to fall back to.
-- Idempotent: safe to run multiple times.

-- Insert a default platform return policy only if the table is empty
INSERT INTO ecommerce_policies (
  id, policy_type, policy_name, policy_data, return_window_days,
  is_active, is_default, created_at, updated_at
)
SELECT
  gen_random_uuid(), 'return', 'Platform Default Return Policy', '{}'::jsonb, 7,
  true, true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM ecommerce_policies LIMIT 1);

-- Backfill any existing rows that have return_window_days = NULL
UPDATE ecommerce_policies
SET return_window_days = 7, updated_at = NOW()
WHERE return_window_days IS NULL;
