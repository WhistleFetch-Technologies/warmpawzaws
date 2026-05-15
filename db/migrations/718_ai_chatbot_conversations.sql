-- ============================================================================
-- AI CHATBOT CONVERSATION TURNS (RDS) — aligns with ai-chatbot.ts inserts
-- ============================================================================
-- Date: 2026-04-16
-- Idempotent: safe if table already exists from manual DDL.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_chatbot_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id TEXT NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_phone TEXT,
    user_message TEXT,
    bot_response TEXT,
    intent TEXT,
    confidence DOUBLE PRECISION,
    requires_agent BOOLEAN DEFAULT false,
    escalated_to_agent BOOLEAN DEFAULT false,
    escalation_reason TEXT,
    escalation_ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_chatbot_conversations_conv
    ON public.ai_chatbot_conversations (conversation_id);

CREATE INDEX IF NOT EXISTS idx_ai_chatbot_conversations_escalation
    ON public.ai_chatbot_conversations (escalation_ticket_id);

COMMENT ON TABLE public.ai_chatbot_conversations IS 'Per-turn AI assistant log; escalation_ticket_id links open tickets for agent transcript';
