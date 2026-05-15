-- ============================================================================
-- 715: support_categories + support_escalation_rules (Support CRM settings)
-- ============================================================================
-- Matches backend support-crm routes:
--   GET/POST /support/settings/categories
--   GET/POST/DELETE /support/settings/escalation-rules
-- Idempotent. No semicolons inside string literals (Data API split-safe).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.support_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    default_priority TEXT NOT NULL DEFAULT 'medium',
    auto_assign_to UUID,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.support_categories ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.support_categories ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.support_categories ADD COLUMN IF NOT EXISTS default_priority TEXT;
ALTER TABLE public.support_categories ADD COLUMN IF NOT EXISTS auto_assign_to UUID;
ALTER TABLE public.support_categories ADD COLUMN IF NOT EXISTS display_order INTEGER;
ALTER TABLE public.support_categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN;
ALTER TABLE public.support_categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE public.support_categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE public.support_categories SET default_priority = COALESCE(default_priority, 'medium') WHERE default_priority IS NULL;
UPDATE public.support_categories SET display_order = COALESCE(display_order, 0) WHERE display_order IS NULL;
UPDATE public.support_categories SET is_active = COALESCE(is_active, true) WHERE is_active IS NULL;
UPDATE public.support_categories SET created_at = COALESCE(created_at, NOW()) WHERE created_at IS NULL;
UPDATE public.support_categories SET updated_at = COALESCE(updated_at, NOW()) WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_support_categories_active_order
    ON public.support_categories (display_order)
    WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.support_escalation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    trigger_value TEXT NOT NULL DEFAULT '0',
    priority_filter TEXT,
    category_filter TEXT,
    escalate_to UUID,
    new_priority TEXT,
    notify_email TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.support_escalation_rules ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.support_escalation_rules ADD COLUMN IF NOT EXISTS trigger_type TEXT;
ALTER TABLE public.support_escalation_rules ADD COLUMN IF NOT EXISTS trigger_value TEXT;
ALTER TABLE public.support_escalation_rules ADD COLUMN IF NOT EXISTS priority_filter TEXT;
ALTER TABLE public.support_escalation_rules ADD COLUMN IF NOT EXISTS category_filter TEXT;
ALTER TABLE public.support_escalation_rules ADD COLUMN IF NOT EXISTS escalate_to UUID;
ALTER TABLE public.support_escalation_rules ADD COLUMN IF NOT EXISTS new_priority TEXT;
ALTER TABLE public.support_escalation_rules ADD COLUMN IF NOT EXISTS notify_email TEXT;
ALTER TABLE public.support_escalation_rules ADD COLUMN IF NOT EXISTS is_active BOOLEAN;
ALTER TABLE public.support_escalation_rules ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE public.support_escalation_rules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE public.support_escalation_rules SET trigger_value = COALESCE(trigger_value, '0') WHERE trigger_value IS NULL;
UPDATE public.support_escalation_rules SET is_active = COALESCE(is_active, true) WHERE is_active IS NULL;
UPDATE public.support_escalation_rules SET created_at = COALESCE(created_at, NOW()) WHERE created_at IS NULL;
UPDATE public.support_escalation_rules SET updated_at = COALESCE(updated_at, NOW()) WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_support_escalation_rules_active
    ON public.support_escalation_rules (is_active)
    WHERE is_active = true;
