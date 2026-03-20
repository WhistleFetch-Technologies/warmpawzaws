-- ============================================================================
-- VENDOR_SETTINGS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL,
    radar_distance_km NUMERIC(5, 2) DEFAULT 10,
    radar_enabled BOOLEAN DEFAULT true,
    service_style_radar_distances JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE vendor_settings ADD CONSTRAINT vendor_settings_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON UPDATE NO ACTION ON DELETE CASCADE;

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE vendor_settings ADD CONSTRAINT vendor_settings_vendor_id_key UNIQUE (vendor_id);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX vendor_settings_pkey ON public.vendor_settings USING btree (id);
CREATE UNIQUE INDEX vendor_settings_vendor_id_key ON public.vendor_settings USING btree (vendor_id);
CREATE INDEX idx_vendor_settings_radar_enabled ON public.vendor_settings USING btree (radar_enabled) WHERE radar_enabled = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE vendor_settings IS 'Vendor-specific settings including radar distance configuration';
COMMENT ON COLUMN vendor_settings.vendor_id IS 'Reference to vendors table';
COMMENT ON COLUMN vendor_settings.radar_distance_km IS 'Default radar distance in kilometers';
COMMENT ON COLUMN vendor_settings.radar_enabled IS 'Whether radar/discovery is enabled for this vendor';
COMMENT ON COLUMN vendor_settings.service_style_radar_distances IS 'Per-service-style radar distances: {at_center: 10, at_home: 5, tele: 0}';
