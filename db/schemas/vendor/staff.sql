-- ============================================================================
-- STAFF TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    vendor_id UUID,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL,
    experience_years INTEGER,
    is_active BOOLEAN DEFAULT true,
    is_individual_provider BOOLEAN DEFAULT false,
    photo TEXT,
    qualifications TEXT,
    default_location JSONB,
    specialization TEXT,
    languages TEXT[],
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE staff ADD CONSTRAINT staff_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON UPDATE NO ACTION ON DELETE CASCADE;

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

-- Phone must be unique globally for active staff (for login)
-- Note: This is enforced via partial unique index

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX staff_pkey ON public.staff USING btree (id);
CREATE UNIQUE INDEX idx_staff_phone_unique ON public.staff USING btree (phone) WHERE is_active = true;
CREATE INDEX idx_staff_vendor_id ON public.staff USING btree (vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX idx_staff_is_active ON public.staff USING btree (is_active) WHERE is_active = true;
CREATE INDEX idx_staff_individual_provider ON public.staff USING btree (is_individual_provider) WHERE is_individual_provider = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE staff IS 'Staff members - maps from staff:{id} KV keys';
COMMENT ON COLUMN staff.vendor_id IS 'Reference to vendors table (nullable for individual providers)';
COMMENT ON COLUMN staff.name IS 'Staff name';
COMMENT ON COLUMN staff.phone IS 'Staff phone number (unique for active staff)';
COMMENT ON COLUMN staff.email IS 'Staff email';
COMMENT ON COLUMN staff.role IS 'Staff role';
COMMENT ON COLUMN staff.experience_years IS 'Years of experience';
COMMENT ON COLUMN staff.is_active IS 'Whether staff is active';
COMMENT ON COLUMN staff.is_individual_provider IS 'Whether staff is an individual provider (not tied to vendor)';
COMMENT ON COLUMN staff.photo IS 'Staff photo URL';
COMMENT ON COLUMN staff.qualifications IS 'Degree, certifications, qualifications';
COMMENT ON COLUMN staff.default_location IS 'Default location for individual providers: {address, lat, lng, place_id, formatted_address}';
COMMENT ON COLUMN staff.specialization IS 'Staff specialization';
COMMENT ON COLUMN staff.languages IS 'Languages spoken by staff';
