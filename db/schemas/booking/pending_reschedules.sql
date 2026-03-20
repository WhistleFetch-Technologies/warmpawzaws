-- ============================================================================
-- PENDING_RESCHEDULES TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS pending_reschedules (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL,
    requested_date DATE NOT NULL,
    requested_time TIME NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    requested_at TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ,
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE pending_reschedules ADD CONSTRAINT pending_reschedules_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE NO ACTION ON DELETE CASCADE;

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE pending_reschedules ADD CONSTRAINT pending_reschedules_status_check CHECK (status IN ('pending', 'approved', 'rejected'));

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX pending_reschedules_pkey ON public.pending_reschedules USING btree (id);
CREATE INDEX idx_pending_reschedules_booking ON public.pending_reschedules USING btree (booking_id);
CREATE INDEX idx_pending_reschedules_status ON public.pending_reschedules USING btree (status);
CREATE INDEX idx_pending_reschedules_requested_at ON public.pending_reschedules USING btree (requested_at DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE pending_reschedules IS 'Pending reschedules - maps from pending_reschedules KV key';
COMMENT ON COLUMN pending_reschedules.booking_id IS 'Reference to bookings table';
COMMENT ON COLUMN pending_reschedules.requested_date IS 'Requested new booking date';
COMMENT ON COLUMN pending_reschedules.requested_time IS 'Requested new booking time';
COMMENT ON COLUMN pending_reschedules.reason IS 'Reason for reschedule request';
COMMENT ON COLUMN pending_reschedules.status IS 'Reschedule status: pending, approved, rejected';
