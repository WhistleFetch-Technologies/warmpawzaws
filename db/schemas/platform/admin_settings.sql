-- ============================================================================
-- ADMIN_SETTINGS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    setting_category TEXT NOT NULL,
    setting_key TEXT NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE admin_settings ADD CONSTRAINT admin_settings_category_key_unique UNIQUE (setting_category, setting_key);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX admin_settings_pkey ON public.admin_settings USING btree (id);
CREATE UNIQUE INDEX admin_settings_category_key_unique ON public.admin_settings USING btree (setting_category, setting_key);
CREATE INDEX idx_admin_settings_category ON public.admin_settings USING btree (setting_category);
CREATE INDEX idx_admin_settings_active ON public.admin_settings USING btree (is_active) WHERE is_active = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE admin_settings IS 'Admin settings - maps from admin:settings:* KV keys';
COMMENT ON COLUMN admin_settings.setting_category IS 'Setting category: payment, payout, refund, schedule, sms, aws, etc.';
COMMENT ON COLUMN admin_settings.setting_key IS 'Setting key';
COMMENT ON COLUMN admin_settings.setting_value IS 'Setting value (JSONB)';
COMMENT ON COLUMN admin_settings.description IS 'Setting description';
