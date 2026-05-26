-- ============================================================================
-- MIGRATION 1020: Notification delivery state machine + delivery log
-- ============================================================================
-- Purpose: Add notification_delivery_status enum, extend notifications with
-- aggregate delivery lifecycle columns, state transition rules, and per-channel
-- notification_delivery_log audit trail.
--
-- State machine: created → queued → sent → delivered → opened
-- Terminal branches: failed, expired
--
-- Legacy tables notification_logs and scheduled_notifications are unchanged.
-- ============================================================================

-- ============================================================================
-- 1. ENUM: notification_delivery_status
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE notification_delivery_status AS ENUM (
    'created',
    'queued',
    'sent',
    'delivered',
    'opened',
    'failed',
    'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE notification_delivery_status IS 'Lifecycle states for notification delivery (lowercase values)';

-- ============================================================================
-- 2. EXTEND notifications (inbox aggregate delivery state)
-- ============================================================================

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS delivery_status notification_delivery_status NOT NULL DEFAULT 'created';

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

COMMENT ON COLUMN notifications.delivery_status IS 'Aggregate delivery lifecycle state for this inbox notification';
COMMENT ON COLUMN notifications.queued_at IS 'When the notification was enqueued for outbound delivery';
COMMENT ON COLUMN notifications.sent_at IS 'When a provider accepted the send request';
COMMENT ON COLUMN notifications.delivered_at IS 'When delivery was confirmed (provider receipt or in-app persist)';
COMMENT ON COLUMN notifications.opened_at IS 'When the recipient opened/read the notification';
COMMENT ON COLUMN notifications.failed_at IS 'When delivery permanently failed for this attempt cycle';
COMMENT ON COLUMN notifications.expired_at IS 'When the notification expired before open/delivery';
COMMENT ON COLUMN notifications.failure_reason IS 'Human-readable failure reason for terminal failed state';
COMMENT ON COLUMN notifications.expires_at IS 'Optional TTL after which undelivered/unopened notifications expire';
COMMENT ON COLUMN notifications.idempotency_key IS 'Optional deduplication key for create/enqueue operations';

CREATE INDEX IF NOT EXISTS idx_notifications_delivery_status
  ON notifications (delivery_status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_idempotency_key
  ON notifications (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Backfill: previously read inbox rows were effectively opened
UPDATE notifications
SET delivery_status = 'opened',
    opened_at = read_at
WHERE is_read = true
  AND read_at IS NOT NULL
  AND delivery_status = 'created';

-- ============================================================================
-- 3. NOTIFICATION STATE TRANSITION RULES
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_state_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    allows_retry BOOLEAN DEFAULT false,
    description TEXT,
    is_allowed BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(from_status, to_status)
);

INSERT INTO notification_state_transitions (from_status, to_status, allows_retry, description) VALUES
    ('created', 'queued', false, 'Notification enqueued for delivery'),
    ('created', 'failed', false, 'Validation or insert failure before enqueue'),
    ('queued', 'sent', false, 'Provider accepted send request'),
    ('queued', 'failed', false, 'Send error or dead-letter'),
    ('queued', 'expired', false, 'TTL expired while queued'),
    ('sent', 'delivered', false, 'Delivery receipt confirmed'),
    ('sent', 'failed', false, 'Bounce or provider reject'),
    ('sent', 'expired', false, 'No delivery receipt within TTL'),
    ('delivered', 'opened', false, 'Recipient opened notification'),
    ('delivered', 'expired', false, 'Never opened before expiry'),
    ('failed', 'queued', true, 'Retry after failure')
ON CONFLICT (from_status, to_status) DO NOTHING;

COMMENT ON TABLE notification_state_transitions IS 'Allowed delivery_status transitions for notifications aggregate state';
COMMENT ON COLUMN notification_state_transitions.allows_retry IS 'True when transition represents a retry path (e.g. failed → queued)';

-- ============================================================================
-- 4. NOTIFICATION DELIVERY LOG (per-channel audit trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_delivery_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('push', 'sms', 'email', 'in_app', 'whatsapp')),
    attempt_number INT NOT NULL DEFAULT 1,
    status notification_delivery_status NOT NULL DEFAULT 'created',
    provider TEXT,
    provider_message_id TEXT,
    device_token_id UUID,
    payload JSONB DEFAULT '{}'::jsonb,
    error_code TEXT,
    error_message TEXT,
    queued_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (notification_id, channel, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_notification_id
  ON notification_delivery_log (notification_id);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_status
  ON notification_delivery_log (status);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_created_at
  ON notification_delivery_log (created_at DESC);

COMMENT ON TABLE notification_delivery_log IS 'Append-only per-channel delivery history; do not conflate with legacy notification_logs';
COMMENT ON COLUMN notification_delivery_log.notification_id IS 'Parent inbox notification row';
COMMENT ON COLUMN notification_delivery_log.channel IS 'Delivery channel: push, sms, email, in_app, whatsapp';
COMMENT ON COLUMN notification_delivery_log.attempt_number IS 'Attempt counter per (notification_id, channel)';
COMMENT ON COLUMN notification_delivery_log.status IS 'Channel-level delivery lifecycle state';
COMMENT ON COLUMN notification_delivery_log.provider IS 'Outbound provider name (sns, ses, etc.)';
COMMENT ON COLUMN notification_delivery_log.provider_message_id IS 'Provider-assigned message identifier';
COMMENT ON COLUMN notification_delivery_log.device_token_id IS 'Optional reference to device_tokens.id for push attempts';
COMMENT ON COLUMN notification_delivery_log.payload IS 'Channel-specific payload snapshot for this attempt';

-- ============================================================================
-- 5. VALIDATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_notification_state_transition(
    p_notification_id UUID,
    p_new_status TEXT,
    OUT allowed BOOLEAN,
    OUT reason TEXT
) AS $$
DECLARE
    v_notification RECORD;
    v_transition RECORD;
BEGIN
    SELECT * INTO v_notification
    FROM notifications
    WHERE id = p_notification_id;

    IF NOT FOUND THEN
        allowed := false;
        reason := 'Notification not found';
        RETURN;
    END IF;

    IF v_notification.delivery_status::TEXT = p_new_status THEN
        allowed := true;
        reason := 'Already in target state';
        RETURN;
    END IF;

    SELECT * INTO v_transition
    FROM notification_state_transitions
    WHERE from_status = v_notification.delivery_status::TEXT
      AND to_status = p_new_status
      AND is_allowed = true;

    IF NOT FOUND THEN
        allowed := false;
        reason := 'Transition from ' || v_notification.delivery_status::TEXT || ' to ' || p_new_status || ' is not allowed';
        RETURN;
    END IF;

    allowed := true;
    reason := 'Transition allowed';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_notification_state_transition IS 'Validates if a notification delivery_status transition is allowed';

-- ============================================================================
-- END OF MIGRATION 1020
-- ============================================================================
