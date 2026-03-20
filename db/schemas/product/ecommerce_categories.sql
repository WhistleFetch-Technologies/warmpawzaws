-- ============================================================================
-- ECOMMERCE_CATEGORIES TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS ecommerce_categories (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    parent_category_id UUID,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE ecommerce_categories ADD CONSTRAINT ecommerce_categories_parent_category_id_fkey FOREIGN KEY (parent_category_id) REFERENCES ecommerce_categories(id) ON UPDATE NO ACTION ON DELETE SET NULL;

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE ecommerce_categories ADD CONSTRAINT ecommerce_categories_name_key UNIQUE (name);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX ecommerce_categories_pkey ON public.ecommerce_categories USING btree (id);
CREATE UNIQUE INDEX ecommerce_categories_name_key ON public.ecommerce_categories USING btree (name);
CREATE INDEX idx_ecommerce_categories_parent ON public.ecommerce_categories USING btree (parent_category_id) WHERE parent_category_id IS NOT NULL;
CREATE INDEX idx_ecommerce_categories_active ON public.ecommerce_categories USING btree (is_active) WHERE is_active = true;
CREATE INDEX idx_ecommerce_categories_display_order ON public.ecommerce_categories USING btree (display_order);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE ecommerce_categories IS 'E-commerce categories - maps from ecommerce:categories, catalog:categories KV keys';
COMMENT ON COLUMN ecommerce_categories.name IS 'Category name (unique)';
COMMENT ON COLUMN ecommerce_categories.description IS 'Category description';
COMMENT ON COLUMN ecommerce_categories.parent_category_id IS 'Reference to parent category (for hierarchical categories)';
COMMENT ON COLUMN ecommerce_categories.display_order IS 'Display order for sorting';
