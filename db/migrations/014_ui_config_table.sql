-- ============================================================================
-- MIGRATION 014: UI Config Table
-- ============================================================================
-- Date: 2025-01-28
-- Purpose: Create table for UI configuration (replaces config:ui:dashboard KV)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ui_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id TEXT NOT NULL,
    config_key TEXT NOT NULL DEFAULT 'dashboard',
    config_value JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(role_id, config_key)
);

CREATE INDEX idx_ui_configs_role_id ON ui_configs(role_id);
CREATE INDEX idx_ui_configs_config_key ON ui_configs(config_key);
CREATE INDEX idx_ui_configs_active ON ui_configs(role_id, config_key) WHERE is_active = true;

COMMENT ON TABLE ui_configs IS 'UI configuration per role - replaces config:ui:dashboard KV keys';
COMMENT ON COLUMN ui_configs.role_id IS 'Vendor role ID (veterinarian, groomer, etc.)';
COMMENT ON COLUMN ui_configs.config_key IS 'Config type (dashboard, landing, etc.)';
COMMENT ON COLUMN ui_configs.config_value IS 'JSONB configuration data';

