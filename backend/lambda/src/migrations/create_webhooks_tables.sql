-- ============================================================================
-- WEBHOOKS TABLES MIGRATION
-- ============================================================================
-- 
-- Creates tables for webhook management and event tracking
-- 
-- Date: 2025-01-28
-- ============================================================================

-- Webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  events JSONB NOT NULL DEFAULT '[]',
  secret TEXT,
  is_active BOOLEAN DEFAULT true,
  retry_count INTEGER DEFAULT 3,
  timeout_seconds INTEGER DEFAULT 30,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT webhooks_url_check CHECK (url ~* '^https?://'),
  CONSTRAINT webhooks_retry_count_check CHECK (retry_count >= 0 AND retry_count <= 10),
  CONSTRAINT webhooks_timeout_check CHECK (timeout_seconds >= 5 AND timeout_seconds <= 120)
);

-- Webhook events table (for tracking delivery history)
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  CONSTRAINT webhook_events_status_check CHECK (status IN ('pending', 'success', 'failed', 'retrying'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_webhooks_events_webhook_id ON webhook_events(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhooks_events_created_at ON webhook_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhooks_events_event_type ON webhook_events(event_type);

-- GIN index for JSONB events array search
CREATE INDEX IF NOT EXISTS idx_webhooks_events_gin ON webhooks USING GIN (events);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_webhooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER webhooks_updated_at_trigger
  BEFORE UPDATE ON webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_webhooks_updated_at();

-- Comments
COMMENT ON TABLE webhooks IS 'Stores webhook configurations for external integrations';
COMMENT ON TABLE webhook_events IS 'Tracks webhook delivery attempts and results';
COMMENT ON COLUMN webhooks.events IS 'JSON array of event types this webhook subscribes to';
COMMENT ON COLUMN webhook_events.payload IS 'JSON payload that was sent to the webhook URL';
