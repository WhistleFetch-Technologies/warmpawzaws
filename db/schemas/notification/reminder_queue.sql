-- ============================================================================
-- REMINDER_QUEUE TABLE - SCHEMA
-- ============================================================================

CREATE TABLE IF NOT EXISTS reminder_queue (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    booking_id UUID,
    reminder_type TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

ALTER TABLE reminder_queue ADD CONSTRAINT reminder_queue_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;
ALTER TABLE reminder_queue ADD CONSTRAINT reminder_queue_status_check CHECK (status IN ('pending', 'sent', 'failed', 'cancelled'));

CREATE UNIQUE INDEX reminder_queue_pkey ON reminder_queue(id);
CREATE INDEX idx_reminder_queue_booking_id ON reminder_queue(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX idx_reminder_queue_scheduled_at ON reminder_queue(scheduled_at);
CREATE INDEX idx_reminder_queue_status ON reminder_queue(status);

COMMENT ON TABLE reminder_queue IS 'Reminder queue - maps from reminders:queue KV key';
