-- ============================================================================
-- MIGRATION 701: GST tax config tied to catalogue category + roles
-- ============================================================================
-- Links tax_categories to service_categories (catalogue) and roles via
-- tax_category_roles. HSN gst_rate becomes optional (rate from tax category).
-- ============================================================================

-- 0) Some environments dropped all constraints on service_categories (admin repair);
--     PostgreSQL requires a PRIMARY KEY or UNIQUE on the referenced column for FKs.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'service_categories'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = current_schema()
      AND t.relname = 'service_categories'
      AND c.contype = 'p'
  ) THEN
    ALTER TABLE service_categories
      ADD CONSTRAINT service_categories_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- 1) Catalogue FK on tax_categories
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'tax_categories' AND column_name = 'catalog_category_id'
  ) THEN
    ALTER TABLE tax_categories
      ADD COLUMN catalog_category_id UUID REFERENCES service_categories(id);
    CREATE INDEX IF NOT EXISTS idx_tax_categories_catalog_category
      ON tax_categories(catalog_category_id) WHERE catalog_category_id IS NOT NULL;
    COMMENT ON COLUMN tax_categories.catalog_category_id IS 'Admin Catalogue → Categories (service_categories.id); GST config applies to this master category';
  END IF;
END $$;

-- 2) Role junction (role_id = roles.id UUID — matches vendors.role_id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'tax_category_roles'
  ) THEN
    CREATE TABLE tax_category_roles (
      tax_category_id UUID NOT NULL REFERENCES tax_categories(id) ON DELETE CASCADE,
      role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      catalog_category_id UUID NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (tax_category_id, role_id),
      CONSTRAINT uq_tax_category_roles_catalog_role UNIQUE (catalog_category_id, role_id)
    );
    CREATE INDEX IF NOT EXISTS idx_tax_category_roles_catalog ON tax_category_roles(catalog_category_id);
    COMMENT ON TABLE tax_category_roles IS 'Which vendor roles a GST tax_categories row applies to; empty junction = all roles (wildcard) for that catalogue category';
  END IF;
END $$;

-- 3) HSN: allow NULL gst_rate (SSOT = linked tax_categories via category_id)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'hsn_codes' AND column_name = 'gst_rate' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE hsn_codes ALTER COLUMN gst_rate DROP NOT NULL;
  END IF;
END $$;
