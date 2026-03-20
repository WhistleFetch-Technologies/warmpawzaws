-- ============================================================================
-- SUPPORT TICKETS: attachments column (customer live chat / CRM)
-- ============================================================================
-- Code paths: POST /support/tickets (support-crm.ts) pass attachment URLs/metadata.
-- Date: 2026-03-20
-- ============================================================================

ALTER TABLE support_tickets
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN support_tickets.attachments IS 'Optional attachment URLs or metadata (JSON array)';
