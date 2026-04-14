-- ============================================================================
-- 716: support_sla_config (Support CRM SLA settings)
-- ============================================================================
-- Matches backend support-crm GET/POST /support/settings/sla
-- Idempotent. No semicolons inside string literals (Data API split-safe).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.support_sla_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    priority TEXT NOT NULL,
    first_response_minutes INTEGER NOT NULL,
    resolution_minutes INTEGER NOT NULL,
    escalation_after_minutes INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.support_sla_config ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.support_sla_config ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE public.support_sla_config ADD COLUMN IF NOT EXISTS first_response_minutes INTEGER;
ALTER TABLE public.support_sla_config ADD COLUMN IF NOT EXISTS resolution_minutes INTEGER;
ALTER TABLE public.support_sla_config ADD COLUMN IF NOT EXISTS escalation_after_minutes INTEGER;
ALTER TABLE public.support_sla_config ADD COLUMN IF NOT EXISTS is_active BOOLEAN;
ALTER TABLE public.support_sla_config ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE public.support_sla_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE public.support_sla_config SET is_active = COALESCE(is_active, true) WHERE is_active IS NULL;
UPDATE public.support_sla_config SET created_at = COALESCE(created_at, NOW()) WHERE created_at IS NULL;
UPDATE public.support_sla_config SET updated_at = COALESCE(updated_at, NOW()) WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_support_sla_config_active_first_response
    ON public.support_sla_config (first_response_minutes)
    WHERE is_active = true;
