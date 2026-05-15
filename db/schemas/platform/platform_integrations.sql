-- ============================================================================
-- PLATFORM_INTEGRATIONS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_integrations (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    integration_name TEXT NOT NULL,
    integration_config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE platform_integrations ADD CONSTRAINT platform_integrations_integration_name_key UNIQUE (integration_name);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX platform_integrations_pkey ON public.platform_integrations USING btree (id);
CREATE UNIQUE INDEX platform_integrations_integration_name_key ON public.platform_integrations USING btree (integration_name);
CREATE INDEX idx_platform_integrations_active ON public.platform_integrations USING btree (is_active) WHERE is_active = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE platform_integrations IS 'Platform integrations - maps from platform:integrations:razorpay, platform:settings:aws KV keys';
COMMENT ON COLUMN platform_integrations.integration_name IS 'Integration name: razorpay, aws, google_maps, etc. (unique)';
COMMENT ON COLUMN platform_integrations.integration_config IS 'Integration configuration (JSONB)';
COMMENT ON COLUMN platform_integrations.is_active IS 'Whether integration is active';
