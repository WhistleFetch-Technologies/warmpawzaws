-- ============================================================================
-- STAFF_CERTIFICATIONS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff_certifications (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL,
    certification_name TEXT NOT NULL,
    certification_url TEXT,
    issued_date DATE,
    expiry_date DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE staff_certifications ADD CONSTRAINT staff_certifications_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id) ON UPDATE NO ACTION ON DELETE CASCADE;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX staff_certifications_pkey ON public.staff_certifications USING btree (id);
CREATE INDEX idx_staff_certifications_staff ON public.staff_certifications USING btree (staff_id);
CREATE INDEX idx_staff_certifications_expiry ON public.staff_certifications USING btree (expiry_date) WHERE expiry_date IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE staff_certifications IS 'Staff certifications';
COMMENT ON COLUMN staff_certifications.staff_id IS 'Reference to staff table';
COMMENT ON COLUMN staff_certifications.certification_name IS 'Name of certification';
COMMENT ON COLUMN staff_certifications.certification_url IS 'URL to certification document';
COMMENT ON COLUMN staff_certifications.issued_date IS 'Date certification was issued';
COMMENT ON COLUMN staff_certifications.expiry_date IS 'Date certification expires (if applicable)';
