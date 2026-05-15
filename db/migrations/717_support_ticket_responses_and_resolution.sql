-- ============================================================================
-- MIGRATION 717: Support CRM — responses table + resolution column
-- ============================================================================
-- Fixes:
--   relation "support_ticket_responses" does not exist
--   column "resolution" of relation "support_tickets" does not exist
-- Safe for dev and prod: IF NOT EXISTS / idempotent.
-- Date: 2026-04-14
-- ============================================================================

-- Short summary text when ticket is resolved/closed (API writes this field)
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS resolution TEXT;

COMMENT ON COLUMN public.support_tickets.resolution IS 'Optional resolution summary when status is resolved/closed';

-- Threaded replies on support tickets (CRM /support/tickets/:id, POST /crm/reply)
CREATE TABLE IF NOT EXISTS public.support_ticket_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL,
    responder_id UUID,
    responder_type TEXT NOT NULL DEFAULT 'agent',
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    responder_name TEXT,
    CONSTRAINT support_ticket_responses_responder_type_check
      CHECK (responder_type IN ('agent', 'customer', 'system'))
);

COMMENT ON TABLE public.support_ticket_responses IS 'Replies / activity on support_tickets (CRM & admin support)';

-- Align older 054 installs that omitted responder_name
ALTER TABLE public.support_ticket_responses
  ADD COLUMN IF NOT EXISTS responder_name TEXT;

-- Foreign key (only when both tables exist and constraint missing)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'support_tickets'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'support_ticket_responses'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'support_ticket_responses_ticket_id_fkey'
  ) THEN
    ALTER TABLE public.support_ticket_responses
      ADD CONSTRAINT support_ticket_responses_ticket_id_fkey
      FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_support_responses_ticket_id
  ON public.support_ticket_responses(ticket_id);

CREATE INDEX IF NOT EXISTS idx_support_responses_responder
  ON public.support_ticket_responses(responder_id)
  WHERE responder_id IS NOT NULL;
