-- ============================================================================
-- Migration: 007a - Vendor Services Table Only
-- Purpose: Create vendor_services table if it doesn't exist
-- Date: 2026-02-14
-- ============================================================================

-- Create vendor_services table if it doesn't exist
CREATE TABLE IF NOT EXISTS vendor_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    service_id UUID NOT NULL, -- References service catalog
    service_name TEXT NOT NULL,
    category TEXT,
    sub_category TEXT,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    service_style TEXT NOT NULL CHECK (service_style IN ('at_center', 'at_home', 'tele')),
    publish_status TEXT NOT NULL DEFAULT 'draft' CHECK (publish_status IN ('draft', 'published', 'auto_published')),
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    is_custom_service BOOLEAN DEFAULT false,
    custom_price DECIMAL(10, 2),
    custom_duration INTEGER,
    custom_description TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(vendor_id, service_id, service_style)
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_vendor_services_vendor_id ON vendor_services(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_services_publish_status ON vendor_services(publish_status, is_enabled);
CREATE INDEX IF NOT EXISTS idx_vendor_services_sub_category ON vendor_services(sub_category);
CREATE INDEX IF NOT EXISTS idx_vendor_services_service_style ON vendor_services(service_style);

COMMENT ON TABLE vendor_services IS 'Vendor published services (replaces KV store)';
