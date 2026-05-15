-- ============================================================================
-- REGIONS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS regions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    country TEXT DEFAULT 'India',
    region_config JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE regions ADD CONSTRAINT regions_name_key UNIQUE (name);
ALTER TABLE regions ADD CONSTRAINT regions_code_key UNIQUE (code);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX regions_pkey ON public.regions USING btree (id);
CREATE UNIQUE INDEX regions_name_key ON public.regions USING btree (name);
CREATE UNIQUE INDEX regions_code_key ON public.regions USING btree (code);
CREATE INDEX idx_regions_active ON public.regions USING btree (is_active) WHERE is_active = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE regions IS 'Regions - maps from region_india, region:{id} KV keys';
COMMENT ON COLUMN regions.name IS 'Region name (unique)';
COMMENT ON COLUMN regions.code IS 'Region code (unique)';
COMMENT ON COLUMN regions.country IS 'Country (default: India)';
COMMENT ON COLUMN regions.region_config IS 'Region configuration (JSONB)';
