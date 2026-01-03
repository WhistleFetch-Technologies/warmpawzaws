-- ============================================================================
-- APPOINTMENT REMINDERS TABLE
-- ============================================================================
-- Table for appointment reminder scheduling and tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS appointment_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('sms', 'push', 'email')),
    scheduled_for TIMESTAMPTZ NOT NULL,
    appointment_time TIMESTAMPTZ NOT NULL,
    hours_before_appointment NUMERIC(4, 2) NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'failed', 'cancelled')),
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointment_reminders_booking_id ON appointment_reminders(booking_id);
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_customer_id ON appointment_reminders(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_scheduled_for ON appointment_reminders(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_status ON appointment_reminders(status);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_appointment_reminders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_appointment_reminders_updated_at
    BEFORE UPDATE ON appointment_reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_appointment_reminders_updated_at();

