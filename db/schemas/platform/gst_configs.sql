-- ============================================================================
-- GST_CONFIGS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS gst_configs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    config_name TEXT NOT NULL,
    gst_percentage NUMERIC(5, 2) NOT NULL,
    cgst_percentage NUMERIC(5, 2),
    sgst_percentage NUMERIC(5, 2),
    igst_percentage NUMERIC(5, 2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE gst_configs ADD CONSTRAINT gst_configs_config_name_key UNIQUE (config_name);

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE gst_configs ADD CONSTRAINT gst_configs_gst_percentage_check CHECK (gst_percentage BETWEEN 0 AND 100);
ALTER TABLE gst_configs ADD CONSTRAINT gst_configs_cgst_percentage_check CHECK (cgst_percentage IS NULL OR cgst_percentage BETWEEN 0 AND 100);
ALTER TABLE gst_configs ADD CONSTRAINT gst_configs_sgst_percentage_check CHECK (sgst_percentage IS NULL OR sgst_percentage BETWEEN 0 AND 100);
ALTER TABLE gst_configs ADD CONSTRAINT gst_configs_igst_percentage_check CHECK (igst_percentage IS NULL OR igst_percentage BETWEEN 0 AND 100);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX gst_configs_pkey ON public.gst_configs USING btree (id);
CREATE UNIQUE INDEX gst_configs_config_name_key ON public.gst_configs USING btree (config_name);
CREATE INDEX idx_gst_configs_active ON public.gst_configs USING btree (is_active) WHERE is_active = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE gst_configs IS 'GST configuration - maps from platform:gst_configs, platform:gst_rules KV keys';
COMMENT ON COLUMN gst_configs.config_name IS 'Configuration name (unique)';
COMMENT ON COLUMN gst_configs.gst_percentage IS 'GST percentage (0-100)';
COMMENT ON COLUMN gst_configs.cgst_percentage IS 'CGST percentage (0-100)';
COMMENT ON COLUMN gst_configs.sgst_percentage IS 'SGST percentage (0-100)';
COMMENT ON COLUMN gst_configs.igst_percentage IS 'IGST percentage (0-100)';
