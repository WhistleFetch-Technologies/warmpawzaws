-- ============================================================================
-- MIGRATION 506: Add icon_color to service_categories (customer-web sync)
-- ============================================================================
-- Purpose: Admin catalog saves icon + iconColor; customer web needs both.
-- ============================================================================

-- Add icon_color if not present (admin POST/PUT already use it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'service_categories' AND column_name = 'icon_color'
  ) THEN
    ALTER TABLE service_categories ADD COLUMN icon_color TEXT;
    RAISE NOTICE 'Added icon_color to service_categories';
  END IF;
END $$;
