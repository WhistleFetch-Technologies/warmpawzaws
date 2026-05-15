-- ============================================================================
-- STAFF_AVAILABILITY TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff_availability (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE staff_availability ADD CONSTRAINT staff_availability_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id) ON UPDATE NO ACTION ON DELETE CASCADE;

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE staff_availability ADD CONSTRAINT staff_availability_staff_date_time_unique UNIQUE (staff_id, date, start_time);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX staff_availability_pkey ON public.staff_availability USING btree (id);
CREATE UNIQUE INDEX staff_availability_staff_date_time_unique ON public.staff_availability USING btree (staff_id, date, start_time);
CREATE INDEX idx_staff_availability_staff_id ON public.staff_availability USING btree (staff_id);
CREATE INDEX idx_staff_availability_date ON public.staff_availability USING btree (date);
CREATE INDEX idx_staff_availability_available ON public.staff_availability USING btree (is_available) WHERE is_available = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE staff_availability IS 'Staff availability slots - maps from staff:{id}:availability KV keys';
COMMENT ON COLUMN staff_availability.staff_id IS 'Reference to staff table';
COMMENT ON COLUMN staff_availability.date IS 'Availability date';
COMMENT ON COLUMN staff_availability.start_time IS 'Availability start time';
COMMENT ON COLUMN staff_availability.end_time IS 'Availability end time';
COMMENT ON COLUMN staff_availability.is_available IS 'Whether staff is available during this slot';
