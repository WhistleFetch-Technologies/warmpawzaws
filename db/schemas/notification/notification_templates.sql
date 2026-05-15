-- ============================================================================
-- NOTIFICATION_TEMPLATES TABLE - SCHEMA
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    template_name TEXT NOT NULL,
    template_type TEXT NOT NULL,
    subject TEXT,
    body_text TEXT NOT NULL,
    body_html TEXT,
    channels JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT notification_templates_template_name_key UNIQUE (template_name)
);

CREATE UNIQUE INDEX notification_templates_pkey ON notification_templates(id);
CREATE UNIQUE INDEX notification_templates_template_name_key ON notification_templates(template_name);
CREATE INDEX idx_notification_templates_type ON notification_templates(template_type);
CREATE INDEX idx_notification_templates_active ON notification_templates(is_active) WHERE is_active = true;

COMMENT ON TABLE notification_templates IS 'Notification templates';
