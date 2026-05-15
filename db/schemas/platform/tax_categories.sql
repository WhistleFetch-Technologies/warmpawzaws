-- ============================================================================
-- TAX_CATEGORIES TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS tax_categories (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    category_name TEXT NOT NULL,
    tax_rate NUMERIC(5, 2) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE tax_categories ADD CONSTRAINT tax_categories_category_name_key UNIQUE (category_name);

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE tax_categories ADD CONSTRAINT tax_categories_tax_rate_check CHECK (tax_rate BETWEEN 0 AND 100);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX tax_categories_pkey ON public.tax_categories USING btree (id);
CREATE UNIQUE INDEX tax_categories_category_name_key ON public.tax_categories USING btree (category_name);
CREATE INDEX idx_tax_categories_active ON public.tax_categories USING btree (is_active) WHERE is_active = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE tax_categories IS 'Tax categories - maps from platform:tax_categories KV key';
COMMENT ON COLUMN tax_categories.category_name IS 'Category name (unique)';
COMMENT ON COLUMN tax_categories.tax_rate IS 'Tax rate (0-100)';
COMMENT ON COLUMN tax_categories.description IS 'Category description';
