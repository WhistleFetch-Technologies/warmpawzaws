-- ============================================================================
-- EMERGENCY_BOOKING_QUEUE TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS emergency_booking_queue (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL,
    priority INTEGER DEFAULT 5,
    queued_at TIMESTAMPTZ DEFAULT now(),
    assigned_vendor_id UUID,
    assigned_at TIMESTAMPTZ,
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE emergency_booking_queue ADD CONSTRAINT emergency_booking_queue_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE emergency_booking_queue ADD CONSTRAINT emergency_booking_queue_assigned_vendor_id_fkey FOREIGN KEY (assigned_vendor_id) REFERENCES vendors(id) ON UPDATE NO ACTION ON DELETE SET NULL;

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE emergency_booking_queue ADD CONSTRAINT emergency_booking_queue_priority_check CHECK (priority BETWEEN 1 AND 10);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX emergency_booking_queue_pkey ON public.emergency_booking_queue USING btree (id);
CREATE INDEX idx_emergency_booking_queue_booking ON public.emergency_booking_queue USING btree (booking_id);
CREATE INDEX idx_emergency_booking_queue_priority ON public.emergency_booking_queue USING btree (priority);
CREATE INDEX idx_emergency_booking_queue_vendor ON public.emergency_booking_queue USING btree (assigned_vendor_id) WHERE assigned_vendor_id IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE emergency_booking_queue IS 'Emergency booking queue - maps from bookings:emergency:queue KV key';
COMMENT ON COLUMN emergency_booking_queue.booking_id IS 'Reference to bookings table';
COMMENT ON COLUMN emergency_booking_queue.priority IS 'Priority level (1-10, higher is more urgent)';
COMMENT ON COLUMN emergency_booking_queue.assigned_vendor_id IS 'Vendor assigned to handle this emergency booking';
