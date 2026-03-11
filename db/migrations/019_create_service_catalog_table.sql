-- ============================================================================
-- SERVICE CATALOG TABLE
-- ============================================================================
-- Purpose: Store master service catalog (replaces platform:service_catalog KV)
-- Date: 2025-01-27
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id TEXT UNIQUE NOT NULL, -- Original service ID from KV
    service_name TEXT NOT NULL,
    display_name TEXT,
    description TEXT,
    category_id TEXT,
    category_name TEXT,
    sub_category_id TEXT,
    sub_category_name TEXT,
    applicable_roles TEXT[] NOT NULL DEFAULT '{}', -- Array of role IDs
    service_style TEXT CHECK (service_style IN ('at_center', 'at_home', 'tele', 'all')),
    base_price DECIMAL(10, 2) DEFAULT 0,
    duration_minutes INTEGER DEFAULT 30,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft')),
    publish_status TEXT DEFAULT 'published' CHECK (publish_status IN ('draft', 'published', 'archived')),
    metadata JSONB,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_catalog_category ON service_catalog(category_id);
CREATE INDEX IF NOT EXISTS idx_service_catalog_sub_category ON service_catalog(sub_category_id);
CREATE INDEX IF NOT EXISTS idx_service_catalog_applicable_roles ON service_catalog USING gin(applicable_roles);
CREATE INDEX IF NOT EXISTS idx_service_catalog_service_style ON service_catalog(service_style);
CREATE INDEX IF NOT EXISTS idx_service_catalog_status ON service_catalog(status, publish_status);

COMMENT ON TABLE service_catalog IS 'Master service catalog - replaces platform:service_catalog KV';
COMMENT ON COLUMN service_catalog.applicable_roles IS 'Array of role IDs that can use this service';

