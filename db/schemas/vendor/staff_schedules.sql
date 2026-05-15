-- ============================================================================
-- STAFF_SCHEDULES TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff_schedules (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL,
    day_of_week INTEGER NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE staff_schedules ADD CONSTRAINT staff_schedules_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES staff(id) ON UPDATE NO ACTION ON DELETE CASCADE;

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE staff_schedules ADD CONSTRAINT staff_schedules_staff_day_time_unique UNIQUE (staff_id, day_of_week, start_time);

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE staff_schedules ADD CONSTRAINT staff_schedules_day_of_week_check CHECK (day_of_week BETWEEN 0 AND 6);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX staff_schedules_pkey ON public.staff_schedules USING btree (id);
CREATE UNIQUE INDEX staff_schedules_staff_day_time_unique ON public.staff_schedules USING btree (staff_id, day_of_week, start_time);
CREATE INDEX idx_staff_schedules_staff_id ON public.staff_schedules USING btree (staff_id);
CREATE INDEX idx_staff_schedules_day ON public.staff_schedules USING btree (day_of_week);
CREATE INDEX idx_staff_schedules_available ON public.staff_schedules USING btree (is_available) WHERE is_available = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE staff_schedules IS 'Staff schedules - maps from staff:{id}:schedule KV keys';
COMMENT ON COLUMN staff_schedules.staff_id IS 'Reference to staff table';
COMMENT ON COLUMN staff_schedules.day_of_week IS 'Day of week (0=Sunday, 6=Saturday)';
COMMENT ON COLUMN staff_schedules.start_time IS 'Schedule start time';
COMMENT ON COLUMN staff_schedules.end_time IS 'Schedule end time';
COMMENT ON COLUMN staff_schedules.is_available IS 'Whether staff is available during this time';
