-- ============================================================================
-- FEATURED_VENDORS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS featured_vendors (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL,
    display_order INTEGER DEFAULT 0,
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE featured_vendors ADD CONSTRAINT featured_vendors_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON UPDATE NO ACTION ON DELETE CASCADE;

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE featured_vendors ADD CONSTRAINT featured_vendors_vendor_id_key UNIQUE (vendor_id);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX featured_vendors_pkey ON public.featured_vendors USING btree (id);
CREATE UNIQUE INDEX featured_vendors_vendor_id_key ON public.featured_vendors USING btree (vendor_id);
CREATE INDEX idx_featured_vendors_active ON public.featured_vendors USING btree (is_active) WHERE is_active = true;
CREATE INDEX idx_featured_vendors_dates ON public.featured_vendors USING btree (start_date, end_date);
CREATE INDEX idx_featured_vendors_display_order ON public.featured_vendors USING btree (display_order);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE featured_vendors IS 'Featured vendors - maps from featured:vendors KV key';
COMMENT ON COLUMN featured_vendors.vendor_id IS 'Reference to vendors table';
COMMENT ON COLUMN featured_vendors.display_order IS 'Display order for featured listing';
COMMENT ON COLUMN featured_vendors.start_date IS 'Feature start date';
COMMENT ON COLUMN featured_vendors.end_date IS 'Feature end date';
COMMENT ON COLUMN featured_vendors.is_active IS 'Whether vendor is currently featured';
