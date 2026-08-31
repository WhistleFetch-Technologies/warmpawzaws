-- Additive: track delivery attempts for async campaign worker (max 2 attempts in app).
ALTER TABLE notification_campaign_deliveries
  ADD COLUMN IF NOT EXISTS attempt INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_notification_campaign_deliveries_pending_claim
  ON notification_campaign_deliveries (campaign_id, status, attempt, created_at, id)
  WHERE status = 'PENDING';

COMMENT ON COLUMN notification_campaign_deliveries.attempt IS
  'Worker claim/attempt count; app caps at 2 for promotional campaign send';
