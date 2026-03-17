-- ============================================================================
-- STAFF_SERVICES TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff_services (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL,
    vendor_id UUID NOT NULL,
    service_id UUID NOT NULL,
    service_name TEXT NOT NULL,
    category TEXT,
    sub_category TEXT,
    price NUMERIC(10, 2),
    duration_minutes INTEGER,
    service_style TEXT NOT NULL,
    service_styles TEXT[] DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    activated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE staff_services ADD CONSTRAINT staff_services_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE staff_services ADD CONSTRAINT staff_services_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON UPDATE NO ACTION ON DELETE CASCADE;

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE staff_services ADD CONSTRAINT staff_services_staff_service_key UNIQUE (staff_id, service_id);

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE staff_services ADD CONSTRAINT staff_services_service_style_check CHECK (service_style IN ('at_center', 'at_home', 'tele'));

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX staff_services_pkey ON public.staff_services USING btree (id);
CREATE UNIQUE INDEX staff_services_staff_service_key ON public.staff_services USING btree (staff_id, service_id);
CREATE INDEX idx_staff_services_staff_id ON public.staff_services USING btree (staff_id);
CREATE INDEX idx_staff_services_vendor_id ON public.staff_services USING btree (vendor_id);
CREATE INDEX idx_staff_services_is_active ON public.staff_services USING btree (is_active) WHERE is_active = true;
CREATE INDEX idx_staff_services_sub_category ON public.staff_services USING btree (sub_category);
CREATE INDEX idx_staff_services_service_styles ON public.staff_services USING gin(service_styles);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE staff_services IS 'Staff active services - maps from staff:{staffId}:service:{serviceId} KV keys';
COMMENT ON COLUMN staff_services.staff_id IS 'Reference to staff table';
COMMENT ON COLUMN staff_services.vendor_id IS 'Reference to vendors table';
COMMENT ON COLUMN staff_services.service_id IS 'Reference to vendor_services.service_id';
COMMENT ON COLUMN staff_services.service_name IS 'Name of the service';
COMMENT ON COLUMN staff_services.category IS 'Service category';
COMMENT ON COLUMN staff_services.sub_category IS 'Service subcategory';
COMMENT ON COLUMN staff_services.price IS 'Service price (if different from vendor service)';
COMMENT ON COLUMN staff_services.duration_minutes IS 'Service duration in minutes';
COMMENT ON COLUMN staff_services.service_style IS 'Service style: at_center, at_home, tele';
COMMENT ON COLUMN staff_services.service_styles IS 'Array of service styles supported';
COMMENT ON COLUMN staff_services.is_active IS 'Whether service is active for this staff member';
COMMENT ON COLUMN staff_services.activated_at IS 'When service was activated for staff';
COMMENT ON COLUMN staff_services.metadata IS 'Additional service metadata (JSONB)';
