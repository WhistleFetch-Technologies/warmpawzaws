-- ============================================================================
-- MIGRATION 621: Keep premium_monthly and monthly_premium in sync
-- ============================================================================
-- Older API builds sometimes wrote only one column. Customer/vendor UI reads
-- COALESCE logic, but both columns should match for tools and future code.
-- ============================================================================

UPDATE insurance_plans
SET premium_monthly = monthly_premium
WHERE (premium_monthly IS NULL OR premium_monthly = 0)
  AND monthly_premium IS NOT NULL
  AND monthly_premium > 0;

UPDATE insurance_plans
SET monthly_premium = premium_monthly
WHERE (monthly_premium IS NULL OR monthly_premium = 0)
  AND premium_monthly IS NOT NULL
  AND premium_monthly > 0;
