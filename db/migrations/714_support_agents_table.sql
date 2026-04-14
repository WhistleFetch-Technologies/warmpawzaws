-- ============================================================================
-- 714: support_agents — Support CRM agent registry
-- ============================================================================
-- Fixes: GET/POST /support/settings/agents → relation "support_agents" does not exist
-- Aligns with backend/lambda support-crm handlers (user_id + staff_id legacy).
-- Safe to re-run (IF NOT EXISTS).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.support_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    staff_id UUID,
    role TEXT NOT NULL DEFAULT 'agent',
    max_concurrent_tickets INTEGER NOT NULL DEFAULT 10,
    specialties TEXT[] NOT NULL DEFAULT ARRAY['general']::TEXT[],
    is_active BOOLEAN NOT NULL DEFAULT true,
    availability_status TEXT,
    last_active_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Older dev DBs may already have support_agents without RBAC columns; CREATE TABLE is skipped.
ALTER TABLE public.support_agents ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.support_agents ADD COLUMN IF NOT EXISTS staff_id UUID;
ALTER TABLE public.support_agents ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE public.support_agents ADD COLUMN IF NOT EXISTS max_concurrent_tickets INTEGER;
ALTER TABLE public.support_agents ADD COLUMN IF NOT EXISTS specialties TEXT[];
ALTER TABLE public.support_agents ADD COLUMN IF NOT EXISTS is_active BOOLEAN;
ALTER TABLE public.support_agents ADD COLUMN IF NOT EXISTS availability_status TEXT;
ALTER TABLE public.support_agents ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
ALTER TABLE public.support_agents ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE public.support_agents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE public.support_agents SET role = COALESCE(role, 'agent') WHERE role IS NULL;
UPDATE public.support_agents SET max_concurrent_tickets = COALESCE(max_concurrent_tickets, 10) WHERE max_concurrent_tickets IS NULL;
UPDATE public.support_agents SET specialties = COALESCE(specialties, ARRAY['general']::TEXT[]) WHERE specialties IS NULL;
UPDATE public.support_agents SET is_active = COALESCE(is_active, true) WHERE is_active IS NULL;
UPDATE public.support_agents SET created_at = COALESCE(created_at, NOW()) WHERE created_at IS NULL;
UPDATE public.support_agents SET updated_at = COALESCE(updated_at, NOW()) WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_support_agents_user_id
    ON public.support_agents (user_id)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_agents_staff_id
    ON public.support_agents (staff_id)
    WHERE staff_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_agents_active
    ON public.support_agents (is_active)
    WHERE is_active = true;

COMMENT ON TABLE public.support_agents IS 'Support CRM agents (user_id = admins.id, staff_id legacy)';
