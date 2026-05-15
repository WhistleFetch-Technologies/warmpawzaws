-- ============================================================================
-- NOTIFICATIONS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    recipient_type TEXT NOT NULL,
    recipient_id UUID NOT NULL,
    notification_type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    channels JSONB NOT NULL,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE notifications ADD CONSTRAINT notifications_recipient_type_check CHECK (recipient_type IN ('customer', 'vendor', 'staff', 'admin'));

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id);
CREATE INDEX idx_notifications_recipient ON public.notifications USING btree (recipient_type, recipient_id);
CREATE INDEX idx_notifications_type ON public.notifications USING btree (notification_type);
CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE notifications IS 'Notifications sent to users';
COMMENT ON COLUMN notifications.recipient_type IS 'Recipient type: customer, vendor, staff, admin';
COMMENT ON COLUMN notifications.recipient_id IS 'Recipient ID (customer_id, vendor_id, etc.)';
COMMENT ON COLUMN notifications.notification_type IS 'Type of notification';
COMMENT ON COLUMN notifications.title IS 'Notification title';
COMMENT ON COLUMN notifications.message IS 'Notification message';
COMMENT ON COLUMN notifications.channels IS 'Channels: {email: true, sms: true, inApp: true, push: false}';
COMMENT ON COLUMN notifications.is_read IS 'Whether notification has been read';
