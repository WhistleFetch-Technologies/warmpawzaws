-- ============================================================================
-- NOTIFICATION TEMPLATE SYSTEM TABLES
-- ============================================================================
-- 
-- Extended tables for comprehensive notification template management.
-- Note: Basic notification_templates table exists in 001_initial_schema.sql
-- This extends it with advanced features: variables, localization, A/B testing, analytics.
-- 
-- Migration: Phase 6 - Complete KV to SQL Migration
-- Date: 2025-01-27
-- ============================================================================

-- ============================================================================
-- ENHANCED NOTIFICATION TEMPLATES
-- ============================================================================
-- Extend existing notification_templates table or create new structure

CREATE TABLE IF NOT EXISTS notification_templates_enhanced (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id TEXT NOT NULL UNIQUE,
    template_name TEXT NOT NULL,
    template_code TEXT NOT NULL UNIQUE,
    channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'whatsapp', 'push')),
    event_type TEXT NOT NULL,
    subject TEXT, -- For email
    body TEXT NOT NULL,
    
    -- Variables (JSONB array)
    variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Metadata (JSONB)
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Settings (JSONB)
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Localization (JSONB)
    localization JSONB,
    
    -- A/B Testing (JSONB)
    ab_test JSONB,
    
    -- Analytics (JSONB)
    analytics JSONB NOT NULL DEFAULT '{
        "totalSent": 0,
        "totalDelivered": 0,
        "totalFailed": 0,
        "totalOpened": 0,
        "totalClicked": 0
    }'::jsonb,
    
    created_by TEXT NOT NULL,
    updated_by TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_sent_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_notification_templates_enhanced_template_id ON notification_templates_enhanced(template_id);
CREATE INDEX idx_notification_templates_enhanced_template_code ON notification_templates_enhanced(template_code);
CREATE INDEX idx_notification_templates_enhanced_channel ON notification_templates_enhanced(channel);
CREATE INDEX idx_notification_templates_enhanced_event_type ON notification_templates_enhanced(event_type);
CREATE INDEX idx_notification_templates_enhanced_active ON notification_templates_enhanced(is_active) WHERE is_active = true;

COMMENT ON TABLE notification_templates_enhanced IS 'Enhanced notification templates - maps from notification-template:{templateId} and notification-template:code:{code} KV keys';

-- ============================================================================
-- NOTIFICATION LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_id TEXT NOT NULL UNIQUE,
    template_id TEXT NOT NULL REFERENCES notification_templates_enhanced(template_id) ON DELETE SET NULL,
    template_code TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'whatsapp', 'push')),
    
    -- Recipient (JSONB)
    recipient JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Variables used (JSONB)
    variables JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Rendered content (JSONB)
    rendered_content JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'sent',
        'delivered',
        'failed',
        'opened',
        'clicked'
    )),
    
    provider TEXT,
    provider_id TEXT,
    error_message TEXT,
    metadata JSONB,
    
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_notification_logs_log_id ON notification_logs(log_id);
CREATE INDEX idx_notification_logs_template_id ON notification_logs(template_id);
CREATE INDEX idx_notification_logs_template_code ON notification_logs(template_code);
CREATE INDEX idx_notification_logs_status ON notification_logs(status);
CREATE INDEX idx_notification_logs_created_at ON notification_logs(created_at DESC);

COMMENT ON TABLE notification_logs IS 'Notification logs - maps from notification-log:{logId} KV keys';

