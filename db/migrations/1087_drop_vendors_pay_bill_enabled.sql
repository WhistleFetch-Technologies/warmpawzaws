-- ============================================================================
-- Migration 1087: Deprecate vendors.pay_bill_enabled (additive — no DROP)
-- ============================================================================
-- Warmpawz Pay eligibility uses admin catalogue publish_status, not this column.
-- Column may remain on older RDS; application code must not read it.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vendors'
      AND column_name = 'pay_bill_enabled'
  ) THEN
    COMMENT ON COLUMN public.vendors.pay_bill_enabled IS
      'DEPRECATED — unused. Warmpawz Pay enablement is warmpawz_pay_vendor_catalog.publish_status.';
    RAISE NOTICE '1087: documented vendors.pay_bill_enabled as deprecated (no drop)';
  ELSE
    RAISE NOTICE '1087: vendors.pay_bill_enabled absent — nothing to document';
  END IF;
END $$;
