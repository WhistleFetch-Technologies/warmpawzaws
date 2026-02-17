-- ============================================================================
-- Admin fixes: products.status, platform_settings setting_type 'json',
-- promotions promotion_type check for admin-created types, order_items compatibility
-- ============================================================================
-- Run: ENVIRONMENT=dev node scripts/run-migration-rds-node.js 562_admin_fixes_products_platform_promotions.sql
-- ============================================================================

-- 1. products.status (admin add product / inventory uses it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'products' AND column_name = 'status'
  ) THEN
    ALTER TABLE products ADD COLUMN status TEXT DEFAULT 'active'
      CHECK (status IN ('draft', 'pending', 'active', 'inactive', 'rejected'));
    COMMENT ON COLUMN products.status IS 'Product status: draft, pending, active, inactive, rejected';
  END IF;
END $$;

-- 2. platform_settings: allow setting_type 'json' (backend uses it)
ALTER TABLE platform_settings DROP CONSTRAINT IF EXISTS platform_settings_setting_type_check;
ALTER TABLE platform_settings ADD CONSTRAINT platform_settings_setting_type_check
  CHECK (setting_type IN ('string', 'number', 'boolean', 'object', 'array', 'json'));

-- 3. promotions: allow admin/UI promotion types (promotion_type or type column)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'promotions') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'promotions' AND column_name = 'promotion_type') THEN
      ALTER TABLE promotions DROP CONSTRAINT IF EXISTS promotions_promotion_type_check;
      ALTER TABLE promotions ADD CONSTRAINT promotions_promotion_type_check
        CHECK (promotion_type IN (
          'discount', 'cashback', 'loyalty_points', 'free_service',
          'flash_sale', 'seasonal', 'buy_x_get_y', 'bundle', 'first_order', 'category_discount', 'loyalty',
          'percentage', 'flat', 'bogo', 'combo', 'spotlight'
        ));
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'promotions' AND column_name = 'type') THEN
      ALTER TABLE promotions DROP CONSTRAINT IF EXISTS promotions_type_check;
      ALTER TABLE promotions ADD CONSTRAINT promotions_type_check
        CHECK (type IN (
          'discount', 'cashback', 'loyalty_points', 'free_service',
          'flash_sale', 'seasonal', 'buy_x_get_y', 'bundle', 'first_order', 'category_discount', 'loyalty',
          'percentage', 'flat', 'bogo', 'combo', 'spotlight'
        ));
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 4. events.end_date (admin event management)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'events') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'events' AND column_name = 'end_date') THEN
      ALTER TABLE events ADD COLUMN end_date DATE;
      COMMENT ON COLUMN events.end_date IS 'End date for multi-day events';
    END IF;
  END IF;
END $$;
