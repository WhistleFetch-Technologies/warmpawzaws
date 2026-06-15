-- ============================================================================
-- SUPPORT TICKET AI ACK + ACTIVITY TIMELINE
-- ============================================================================
-- Extends lifecycle states, AI acknowledgement metrics, responder_type system_ai,
-- and dedicated support_ticket_activity for admin operational timeline.
-- ============================================================================

-- New lifecycle statuses (additive)
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check;

ALTER TABLE support_tickets
ADD CONSTRAINT support_tickets_status_check
CHECK (status IN (
  'open',
  'ai_acknowledged',
  'awaiting_assignment',
  'assigned',
  'in_progress',
  'waiting_for_customer',
  'resolved',
  'closed',
  'escalated',
  'cancelled'
));

-- AI acknowledgement metrics
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS ai_ack_generated_at TIMESTAMPTZ;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS ai_ack_latency_ms INTEGER;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS ai_ack_success BOOLEAN;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS ai_ack_failed BOOLEAN;

COMMENT ON COLUMN support_tickets.ai_ack_generated_at IS 'When system AI acknowledgement was posted';
COMMENT ON COLUMN support_tickets.ai_ack_latency_ms IS 'Bedrock ack generation latency in milliseconds';
COMMENT ON COLUMN support_tickets.ai_ack_success IS 'True when AI acknowledgement was posted successfully';
COMMENT ON COLUMN support_tickets.ai_ack_failed IS 'True when AI acknowledgement failed and fallback was used';

-- Allow system_ai responder type for auto-acknowledgement messages
ALTER TABLE support_ticket_responses DROP CONSTRAINT IF EXISTS support_ticket_responses_responder_type_check;

ALTER TABLE support_ticket_responses
ADD CONSTRAINT support_ticket_responses_responder_type_check
CHECK (responder_type IN ('agent', 'customer', 'system', 'system_ai'));

-- Operational activity timeline (admin-only UI; separate from conversation)
CREATE TABLE IF NOT EXISTS support_ticket_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_actor_type TEXT,
  event_actor_id UUID,
  event_title TEXT NOT NULL,
  event_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_activity_ticket_id
  ON support_ticket_activity (ticket_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_support_ticket_activity_event_type
  ON support_ticket_activity (event_type);

COMMENT ON TABLE support_ticket_activity IS 'Admin operational timeline for support tickets (not customer-facing)';
