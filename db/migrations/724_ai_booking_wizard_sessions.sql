-- ============================================================================
-- AI BOOKING WIZARD — customer-web draft sessions (RDS, versioned, TTL)
-- ============================================================================
-- Date: 2026-04-16
-- Idempotent: safe if table already exists.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_booking_wizard_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version INTEGER NOT NULL DEFAULT 1,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_phone TEXT,
    category TEXT NOT NULL DEFAULT 'vet',
    vendor_id UUID,
    vendor_service_id UUID,
    service_style TEXT,
    booking_date TEXT,
    slot_time TEXT,
    total_duration INTEGER NOT NULL DEFAULT 30,
    staff_id TEXT,
    pet_id UUID,
    address_id UUID,
    slots_snapshot TEXT,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'ready_for_booking', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_booking_wizard_sessions_customer
    ON public.ai_booking_wizard_sessions (customer_id);

CREATE INDEX IF NOT EXISTS idx_ai_booking_wizard_sessions_phone
    ON public.ai_booking_wizard_sessions (customer_phone);

CREATE INDEX IF NOT EXISTS idx_ai_booking_wizard_sessions_expires
    ON public.ai_booking_wizard_sessions (expires_at);

COMMENT ON TABLE public.ai_booking_wizard_sessions IS 'Server-backed booking draft for in-chat wizard; slots_snapshot is JSON from available-slots for commit validation when self-HTTP is unavailable';
