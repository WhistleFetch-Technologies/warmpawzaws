-- ============================================================================
-- 1033: support_reply_templates (Saved Replies / Macros for Support CRM)
-- ============================================================================
-- Agent-facing: GET /crm/reply-templates
-- Admin settings: GET/POST/DELETE /support/settings/reply-templates
-- Idempotent. No semicolons inside string literals (Data API split-safe).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.support_reply_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    content TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.support_reply_templates ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.support_reply_templates ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.support_reply_templates ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.support_reply_templates ADD COLUMN IF NOT EXISTS is_active BOOLEAN;
ALTER TABLE public.support_reply_templates ADD COLUMN IF NOT EXISTS is_system BOOLEAN;
ALTER TABLE public.support_reply_templates ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.support_reply_templates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE public.support_reply_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE public.support_reply_templates SET category = COALESCE(category, 'General') WHERE category IS NULL;
UPDATE public.support_reply_templates SET is_active = COALESCE(is_active, true) WHERE is_active IS NULL;
UPDATE public.support_reply_templates SET is_system = COALESCE(is_system, false) WHERE is_system IS NULL;
UPDATE public.support_reply_templates SET created_at = COALESCE(created_at, NOW()) WHERE created_at IS NULL;
UPDATE public.support_reply_templates SET updated_at = COALESCE(updated_at, NOW()) WHERE updated_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_reply_templates_name
    ON public.support_reply_templates (name);

CREATE INDEX IF NOT EXISTS idx_support_reply_templates_active_category
    ON public.support_reply_templates (category, name)
    WHERE is_active = true;

INSERT INTO public.support_reply_templates (name, category, content, is_active, is_system, created_by)
VALUES
(
    'Refund Under Review',
    'Refund',
    'Hello,

Your refund request has been received and is currently being reviewed.

We will update you once the review is completed.

Thank you for your patience.',
    true,
    true,
    NULL
),
(
    'Need Screenshot',
    'Technical',
    'Hello,

Could you please share a screenshot of the issue so that we can investigate further?

Thank you.',
    true,
    true,
    NULL
),
(
    'Booking Investigation',
    'Booking',
    'Hello,

We are currently reviewing the details of your booking with the service provider.

We will update you as soon as we have more information.',
    true,
    true,
    NULL
),
(
    'Need More Information',
    'General',
    'Hello,

Could you please provide additional details regarding the issue you are facing?

This will help us investigate faster.',
    true,
    true,
    NULL
),
(
    'Refund Processed',
    'Refund',
    'Hello,

Your refund has been successfully processed.

Depending on your payment provider, it may take a few business days to reflect in your account.

Thank you.',
    true,
    true,
    NULL
)
ON CONFLICT (name) DO NOTHING;
