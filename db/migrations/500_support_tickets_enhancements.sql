-- ============================================================================
-- SUPPORT TICKETS ENHANCEMENTS
-- ============================================================================
-- Adds missing columns required by the Support CRM functionality
-- Date: 2026-01-29
-- ============================================================================

-- Add source column to track where the ticket originated from
ALTER TABLE support_tickets 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'customer' 
CHECK (source IN ('customer', 'vendor', 'ai_chatbot', 'chat_handoff', 'admin', 'system'));

-- Add escalation tracking
ALTER TABLE support_tickets 
ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

ALTER TABLE support_tickets 
ADD COLUMN IF NOT EXISTS escalation_reason TEXT;

-- Add last_updated_at for tracking latest changes
ALTER TABLE support_tickets 
ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update status constraint to include escalated
ALTER TABLE support_tickets 
DROP CONSTRAINT IF EXISTS support_tickets_status_check;

ALTER TABLE support_tickets 
ADD CONSTRAINT support_tickets_status_check 
CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'escalated', 'cancelled'));

-- Add index for source filtering
CREATE INDEX IF NOT EXISTS idx_support_tickets_source ON support_tickets(source);

-- Add responder_name column to support_ticket_responses
ALTER TABLE support_ticket_responses
ADD COLUMN IF NOT EXISTS responder_name TEXT;

-- Update existing records with default values
UPDATE support_tickets SET source = 'customer' WHERE source IS NULL;
UPDATE support_tickets SET last_updated_at = updated_at WHERE last_updated_at IS NULL;

COMMENT ON COLUMN support_tickets.source IS 'Origin of the ticket: customer, vendor, ai_chatbot, chat_handoff, admin, system';
COMMENT ON COLUMN support_tickets.escalated_at IS 'Timestamp when ticket was escalated';
COMMENT ON COLUMN support_tickets.last_updated_at IS 'Timestamp of last update to the ticket';
