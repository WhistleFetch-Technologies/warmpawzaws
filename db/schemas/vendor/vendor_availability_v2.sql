-- ============================================================================
-- VENDOR_AVAILABILITY_V2 TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_availability_v2 (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL,
    day_of_week INTEGER NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    service_style TEXT,
    service_styles TEXT[] DEFAULT '{}',
    location_data JSONB,
    buffer_time INTEGER DEFAULT 15,
    max_capacity INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT valid_availability_time CHECK (start_time < end_time),
    CONSTRAINT day_of_week_check CHECK (day_of_week >= 0 AND day_of_week <= 6)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE vendor_availability_v2 ADD CONSTRAINT vendor_availability_v2_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON UPDATE NO ACTION ON DELETE CASCADE;

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE vendor_availability_v2 ADD CONSTRAINT vendor_availability_v2_service_style_check CHECK (service_style IS NULL OR service_style IN ('at_center', 'at_home', 'tele'));

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX vendor_availability_v2_pkey ON public.vendor_availability_v2 USING btree (id);
CREATE INDEX idx_vendor_availability_v2_vendor ON public.vendor_availability_v2 USING btree (vendor_id);
CREATE INDEX idx_vendor_availability_v2_day ON public.vendor_availability_v2 USING btree (day_of_week);
CREATE INDEX idx_vendor_availability_v2_active ON public.vendor_availability_v2 USING btree (is_active) WHERE is_active = true;
CREATE INDEX idx_vendor_availability_service_styles ON public.vendor_availability_v2 USING gin(service_styles);
CREATE INDEX idx_vendor_availability_service_style ON public.vendor_availability_v2 USING btree (service_style) WHERE service_style IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE vendor_availability_v2 IS 'Vendor availability slots with multi-style support';
COMMENT ON COLUMN vendor_availability_v2.vendor_id IS 'Reference to vendors table';
COMMENT ON COLUMN vendor_availability_v2.day_of_week IS 'Day of week (0=Sunday, 6=Saturday)';
COMMENT ON COLUMN vendor_availability_v2.start_time IS 'Slot start time';
COMMENT ON COLUMN vendor_availability_v2.end_time IS 'Slot end time';
COMMENT ON COLUMN vendor_availability_v2.service_style IS 'Legacy single service style (deprecated, use service_styles)';
COMMENT ON COLUMN vendor_availability_v2.service_styles IS 'Array of service styles this slot supports: at_center, at_home, tele';
COMMENT ON COLUMN vendor_availability_v2.location_data IS 'Location data for solo providers: {address, lat, lng, place_id, formatted_address}';
COMMENT ON COLUMN vendor_availability_v2.buffer_time IS 'Buffer time between appointments in minutes';
COMMENT ON COLUMN vendor_availability_v2.max_capacity IS 'Maximum number of bookings that can be scheduled in this slot';
