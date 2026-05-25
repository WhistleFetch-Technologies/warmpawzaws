-- ============================================================================
-- MIGRATION 1012: Dedicated tax category for meal plans
-- ============================================================================
-- Creates a "Meal Plans" tax category (GST-controlled by Admin) and links
-- meal_plans to it so the platform rate can be changed without touching code.
-- ============================================================================

-- 1. Ensure tax_categories exists (created in migration 213 or 701)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tax_categories'
  ) THEN
    CREATE TABLE tax_categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      default_gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 5,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- 2. Seed default meal-plan categories (idempotent)
-- Prod and some DBs still use 001_initial_schema shape: category_name + tax_rate (not name + default_gst_rate).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tax_categories' AND column_name = 'name'
  ) THEN
    INSERT INTO tax_categories (name, description, default_gst_rate, is_active)
    VALUES
      ('Meal Plans - Food',
       'Pet prepared meals and nutrition subscriptions (food component). Default GST 5% (prepared pet food). Admin can update.',
       5.00, TRUE),
      ('Meal Plans - Delivery Fee',
       'Delivery fee component of meal plan orders. Default GST 18%. Admin can update.',
       18.00, TRUE)
    ON CONFLICT (name) DO NOTHING;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tax_categories' AND column_name = 'category_name'
  ) THEN
    INSERT INTO tax_categories (category_name, description, tax_rate, is_active)
    VALUES
      ('Meal Plans - Food',
       'Pet prepared meals and nutrition subscriptions (food component). Default GST 5% (prepared pet food). Admin can update.',
       5.00, TRUE),
      ('Meal Plans - Delivery Fee',
       'Delivery fee component of meal plan orders. Default GST 18%. Admin can update.',
       18.00, TRUE)
    ON CONFLICT (category_name) DO NOTHING;
  END IF;
END $$;

-- 3. Add tax_category_id to meal_plans (optional per-plan override)
ALTER TABLE meal_plans
  ADD COLUMN IF NOT EXISTS tax_category_id UUID
    REFERENCES tax_categories(id) ON DELETE SET NULL;

-- 4. Add a platform-level default column: nullable; when NULL, pricing uses
--    the category seeded above (looked up by name).
COMMENT ON COLUMN meal_plans.tax_category_id IS
  'Optional override. When NULL, the platform uses the "Meal Plans - Food" tax category from tax_categories.';
