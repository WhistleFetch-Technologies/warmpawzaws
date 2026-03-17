-- ============================================================================
-- PLATFORM_SETTINGS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    setting_key TEXT NOT NULL,
    setting_value JSONB NOT NULL,
    setting_type TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE platform_settings ADD CONSTRAINT platform_settings_setting_key_key UNIQUE (setting_key);

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE platform_settings ADD CONSTRAINT platform_settings_setting_type_check CHECK (setting_type IN ('string', 'number', 'boolean', 'object', 'array'));

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX platform_settings_pkey ON public.platform_settings USING btree (id);
CREATE UNIQUE INDEX platform_settings_setting_key_key ON public.platform_settings USING btree (setting_key);
CREATE INDEX idx_platform_settings_public ON public.platform_settings USING btree (is_public) WHERE is_public = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE platform_settings IS 'Platform settings - maps from platform:settings, platform_settings KV keys';
COMMENT ON COLUMN platform_settings.setting_key IS 'Setting key (unique)';
COMMENT ON COLUMN platform_settings.setting_value IS 'Setting value (JSONB)';
COMMENT ON COLUMN platform_settings.setting_type IS 'Setting type: string, number, boolean, object, array';
COMMENT ON COLUMN platform_settings.is_public IS 'Whether setting is public';
