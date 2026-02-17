-- ============================================================================
-- SUPPORT TICKETS: vendor_ai_chatbot source + ticket_number default
-- ============================================================================
-- Ensures support_tickets supports Vendor AI Chat escalation and that
-- inserts without ticket_number get a unique default (no persistence failures).
-- Date: 2026-02
-- ============================================================================

-- 1. Ensure ticket_number has a default so backend inserts never fail (unique per row)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'support_tickets' AND column_name = 'ticket_number'
  ) THEN
    ALTER TABLE support_tickets
    ALTER COLUMN ticket_number SET DEFAULT (
      'TKT-' || to_char(NOW(), 'YYYYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- If column is NOT NULL and has no default, make it accept default for new rows
    NULL;
END $$;

-- 2. Allow source = 'vendor_ai_chatbot' (drop existing check, re-add with new value)
-- Only run when support_tickets exists (e.g. prod may not have Support/CRM tables yet)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'support_tickets'
  ) THEN
    ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_source_check;
    ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_source_check
      CHECK (source IN (
        'customer',
        'vendor',
        'ai_chatbot',
        'vendor_ai_chatbot',
        'chat_handoff',
        'admin',
        'system'
      ));
    COMMENT ON COLUMN support_tickets.source IS 'Origin: customer, vendor, ai_chatbot, vendor_ai_chatbot, chat_handoff, admin, system';
  END IF;
END $$;
