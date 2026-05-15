-- ============================================================================
-- STAFF_SPECIALIZATIONS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff_specializations (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL,
    specialization TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE staff_specializations ADD CONSTRAINT staff_specializations_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id) ON UPDATE NO ACTION ON DELETE CASCADE;

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE staff_specializations ADD CONSTRAINT staff_specializations_staff_specialization_key UNIQUE (staff_id, specialization);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX staff_specializations_pkey ON public.staff_specializations USING btree (id);
CREATE UNIQUE INDEX staff_specializations_staff_specialization_key ON public.staff_specializations USING btree (staff_id, specialization);
CREATE INDEX idx_staff_specializations_staff ON public.staff_specializations USING btree (staff_id);
CREATE INDEX idx_staff_specializations_specialization ON public.staff_specializations USING btree (specialization);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE staff_specializations IS 'Staff specializations (many-to-many)';
COMMENT ON COLUMN staff_specializations.staff_id IS 'Reference to staff table';
COMMENT ON COLUMN staff_specializations.specialization IS 'Specialization name';
