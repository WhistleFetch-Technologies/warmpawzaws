-- ============================================================================
-- MIGRATION 054: Missing Admin UI Tables
-- ============================================================================
-- Purpose: Create tables for Admin UI endpoints that are missing
-- Date: 2026-01-12
-- Note: Safely handles existing tables with different schemas
-- ============================================================================

-- Spotlight Offers (for Marketing & Promotions)
CREATE TABLE IF NOT EXISTS spotlight_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id TEXT,
    service_category TEXT,
    title TEXT NOT NULL,
    subtitle TEXT,
    discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC(10, 2) DEFAULT 0,
    badge_text TEXT,
    icon TEXT,
    image_url TEXT,
    cta_text TEXT,
    cta_link TEXT,
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_spotlight_offers_role') THEN
        CREATE INDEX idx_spotlight_offers_role ON spotlight_offers(role_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_spotlight_offers_active') THEN
        CREATE INDEX idx_spotlight_offers_active ON spotlight_offers(is_active, end_date);
    END IF;
END $$;

-- Notifications table already exists with different schema
-- Skip creating it, but ensure we have the columns we need for admin notifications
-- Note: Existing notifications table has: recipient_type, recipient_id, notification_type, title, message, channels, is_read, read_at, created_at
-- We'll use the existing table structure for admin notifications

-- Support Ticket Responses (for CRM)
CREATE TABLE IF NOT EXISTS support_ticket_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL,
    responder_id UUID,
    responder_type TEXT NOT NULL DEFAULT 'agent' CHECK (responder_type IN ('agent', 'customer', 'system')),
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key only if support_tickets table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'support_tickets') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'support_ticket_responses_ticket_id_fkey'
        ) THEN
            ALTER TABLE support_ticket_responses 
            ADD CONSTRAINT support_ticket_responses_ticket_id_fkey 
            FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_support_responses_ticket_id') THEN
        CREATE INDEX idx_support_responses_ticket_id ON support_ticket_responses(ticket_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_support_responses_responder') THEN
        CREATE INDEX idx_support_responses_responder ON support_ticket_responses(responder_id) WHERE responder_id IS NOT NULL;
    END IF;
END $$;

-- Report Templates (for Reports)
CREATE TABLE IF NOT EXISTS report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK (category IN ('financial', 'operational', 'vendor', 'customer', 'custom')),
    parameters JSONB DEFAULT '[]'::jsonb,
    schedule JSONB,
    last_generated TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_report_templates_category') THEN
        CREATE INDEX idx_report_templates_category ON report_templates(category);
    END IF;
END $$;

-- Generated Reports (for Reports)
CREATE TABLE IF NOT EXISTS generated_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID,
    template_name TEXT,
    parameters JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'completed', 'failed')),
    format TEXT NOT NULL DEFAULT 'pdf' CHECK (format IN ('pdf', 'csv', 'xlsx')),
    download_url TEXT,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    generated_by UUID
);

-- Add foreign key only if report_templates table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'report_templates') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'generated_reports_template_id_fkey'
        ) THEN
            ALTER TABLE generated_reports 
            ADD CONSTRAINT generated_reports_template_id_fkey 
            FOREIGN KEY (template_id) REFERENCES report_templates(id);
        END IF;
    END IF;
END $$;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'generated_reports') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'generated_reports' AND column_name = 'template_id') THEN
            IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_generated_reports_template') THEN
                CREATE INDEX idx_generated_reports_template ON generated_reports(template_id);
            END IF;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'generated_reports' AND column_name = 'status') THEN
            IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_generated_reports_status') THEN
                CREATE INDEX idx_generated_reports_status ON generated_reports(status);
            END IF;
        END IF;
    END IF;
END $$;

-- Saved Reports (for Reports)
CREATE TABLE IF NOT EXISTS saved_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    template_id UUID,
    parameters JSONB DEFAULT '{}'::jsonb,
    is_favorite BOOLEAN DEFAULT false,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key only if report_templates table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'report_templates') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'saved_reports_template_id_fkey'
        ) THEN
            ALTER TABLE saved_reports 
            ADD CONSTRAINT saved_reports_template_id_fkey 
            FOREIGN KEY (template_id) REFERENCES report_templates(id);
        END IF;
    END IF;
END $$;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'saved_reports') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saved_reports' AND column_name = 'template_id') THEN
            IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_saved_reports_template') THEN
                CREATE INDEX idx_saved_reports_template ON saved_reports(template_id);
            END IF;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_saved_reports_favorite') THEN
            CREATE INDEX idx_saved_reports_favorite ON saved_reports(is_favorite) WHERE is_favorite = true;
        END IF;
    END IF;
END $$;

-- Audit Logs (for Governance)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    performed_by TEXT,
    actor_type TEXT DEFAULT 'admin',
    resource_type TEXT,
    resource_id UUID,
    details JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failure')),
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_action') THEN
            CREATE INDEX idx_audit_logs_action ON audit_logs(action);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_resource') THEN
            CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_performed_at') THEN
            CREATE INDEX idx_audit_logs_performed_at ON audit_logs(performed_at DESC);
        END IF;
    END IF;
END $$;

-- Content Pages (for Content Management)
CREATE TABLE IF NOT EXISTS content_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    content TEXT,
    category TEXT CHECK (category IN ('legal', 'help', 'marketing', 'other')),
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_pages_slug ON content_pages(slug);
CREATE INDEX IF NOT EXISTS idx_content_pages_category ON content_pages(category);
CREATE INDEX IF NOT EXISTS idx_content_pages_published ON content_pages(is_published) WHERE is_published = true;

COMMENT ON TABLE spotlight_offers IS 'Marketing spotlight offers for featured vendors/services';
COMMENT ON TABLE support_ticket_responses IS 'Responses to support tickets';
COMMENT ON TABLE report_templates IS 'Report generation templates';
COMMENT ON TABLE generated_reports IS 'Generated reports';
COMMENT ON TABLE saved_reports IS 'Saved report configurations';
COMMENT ON TABLE audit_logs IS 'Audit log for admin actions';
COMMENT ON TABLE content_pages IS 'Content management pages (legal, help, marketing)';
