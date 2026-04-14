-- ============================================================================
-- MIGRATION 711: Customer dashboard visibility per catalogue category
-- ============================================================================
-- Adds DB-driven visibility (GLOBAL / STATE / CITY) and a customer-dashboard
-- launch flag. Safe defaults keep existing behaviour (GLOBAL, card active).
-- Does not touch GST / tax tables.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'service_categories' AND column_name = 'customer_visibility_type'
  ) THEN
    ALTER TABLE service_categories
      ADD COLUMN customer_visibility_type TEXT NOT NULL DEFAULT 'GLOBAL';
    RAISE NOTICE 'Added customer_visibility_type to service_categories';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'service_categories' AND column_name = 'customer_visibility_state'
  ) THEN
    ALTER TABLE service_categories ADD COLUMN customer_visibility_state TEXT;
    RAISE NOTICE 'Added customer_visibility_state to service_categories';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'service_categories' AND column_name = 'customer_visibility_city'
  ) THEN
    ALTER TABLE service_categories ADD COLUMN customer_visibility_city TEXT;
    RAISE NOTICE 'Added customer_visibility_city to service_categories';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'service_categories' AND column_name = 'customer_dashboard_card_active'
  ) THEN
    ALTER TABLE service_categories
      ADD COLUMN customer_dashboard_card_active BOOLEAN NOT NULL DEFAULT true;
    RAISE NOTICE 'Added customer_dashboard_card_active to service_categories';
  END IF;
END $$;

-- Backfill: treat NULL legacy as GLOBAL + card on (column defaults already set for new rows)
UPDATE service_categories
SET
  customer_visibility_type = COALESCE(NULLIF(TRIM(customer_visibility_type), ''), 'GLOBAL'),
  customer_dashboard_card_active = COALESCE(customer_dashboard_card_active, true)
WHERE customer_visibility_type IS NULL
   OR customer_dashboard_card_active IS NULL;

COMMENT ON COLUMN service_categories.customer_visibility_type IS 'Customer home tile visibility: GLOBAL | STATE | CITY';
COMMENT ON COLUMN service_categories.customer_visibility_state IS 'When type=STATE or CITY: state name or code to match customer location';
COMMENT ON COLUMN service_categories.customer_visibility_city IS 'When type=CITY: city name to match customer location';
COMMENT ON COLUMN service_categories.customer_dashboard_card_active IS 'When false, category is hidden from customer home tiles (catalog category still exists for GST/vendor use)';
