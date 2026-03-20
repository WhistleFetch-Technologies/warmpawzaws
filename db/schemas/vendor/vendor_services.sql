-- ============================================================================
-- VENDOR_SERVICES TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_services (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL,
    service_id UUID,
    service_name TEXT NOT NULL,
    category TEXT,
    sub_category TEXT,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    service_style TEXT NOT NULL,
    publish_status TEXT NOT NULL DEFAULT 'draft',
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    is_custom_service BOOLEAN DEFAULT false,
    custom_price NUMERIC(10, 2),
    custom_duration INTEGER,
    custom_description TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE vendor_services ADD CONSTRAINT vendor_services_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON UPDATE NO ACTION ON DELETE CASCADE;

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE vendor_services ADD CONSTRAINT unique_vendor_service_style UNIQUE (vendor_id, service_id, service_style);

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE vendor_services ADD CONSTRAINT vendor_services_service_style_check CHECK (service_style IN ('at_center', 'at_home', 'tele'));
ALTER TABLE vendor_services ADD CONSTRAINT vendor_services_publish_status_check CHECK (publish_status IN ('draft', 'published', 'auto_published', 'pending_approval'));

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX vendor_services_pkey ON public.vendor_services USING btree (id);
CREATE UNIQUE INDEX unique_vendor_service_style ON public.vendor_services USING btree (vendor_id, service_id, service_style);
CREATE INDEX idx_vendor_services_vendor_id ON public.vendor_services USING btree (vendor_id);
CREATE INDEX idx_vendor_services_publish_status ON public.vendor_services USING btree (publish_status, is_enabled);
CREATE INDEX idx_vendor_services_sub_category ON public.vendor_services USING btree (sub_category);
CREATE INDEX idx_vendor_services_service_style ON public.vendor_services USING btree (service_style);
CREATE INDEX idx_vendor_services_enabled ON public.vendor_services USING btree (is_enabled) WHERE is_enabled = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE vendor_services IS 'Vendor published services - maps from vendor_services:{vendorId}:{style} KV keys';
COMMENT ON COLUMN vendor_services.vendor_id IS 'Reference to vendors table';
COMMENT ON COLUMN vendor_services.service_id IS 'Reference to service catalog (if from catalog)';
COMMENT ON COLUMN vendor_services.service_name IS 'Name of the service';
COMMENT ON COLUMN vendor_services.category IS 'Service category';
COMMENT ON COLUMN vendor_services.sub_category IS 'Service subcategory';
COMMENT ON COLUMN vendor_services.price IS 'Service price';
COMMENT ON COLUMN vendor_services.duration_minutes IS 'Service duration in minutes';
COMMENT ON COLUMN vendor_services.service_style IS 'Service style: at_center, at_home, tele';
COMMENT ON COLUMN vendor_services.publish_status IS 'Publish status: draft, published, auto_published, pending_approval';
COMMENT ON COLUMN vendor_services.is_enabled IS 'Whether service is enabled';
COMMENT ON COLUMN vendor_services.is_custom_service IS 'Whether this is a custom service (not from catalog)';
COMMENT ON COLUMN vendor_services.custom_price IS 'Custom price override';
COMMENT ON COLUMN vendor_services.custom_duration IS 'Custom duration override';
COMMENT ON COLUMN vendor_services.custom_description IS 'Custom description override';
COMMENT ON COLUMN vendor_services.metadata IS 'Additional service metadata (JSONB)';
