-- Migration: Discovery System SQL Migration
-- Purpose: Create SQL tables for discovery system (NO KV STORE)
-- Date: 2025-01-22

-- ============================================
-- VENDOR SERVICES TABLE
-- ============================================
-- Stores vendor's published services (replaces KV: vendor_services:{vendorId}:{style})
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

CREATE INDEX IF NOT EXISTS idx_vendor_services_vendor_id ON vendor_services(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_services_publish_status ON vendor_services(publish_status, is_enabled);
CREATE INDEX IF NOT EXISTS idx_vendor_services_sub_category ON vendor_services(sub_category);
CREATE INDEX IF NOT EXISTS idx_vendor_services_service_style ON vendor_services(service_style);

-- ============================================
-- STAFF SERVICES TABLE
-- ============================================
-- Stores staff's active services (replaces KV: staff:{staffId}:service:{serviceId})
CREATE TABLE IF NOT EXISTS staff_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    service_id UUID NOT NULL, -- References vendor_services.service_id
    service_name TEXT NOT NULL,
    category TEXT,
    sub_category TEXT,
    price DECIMAL(10, 2),
    duration_minutes INTEGER,
    service_style TEXT NOT NULL CHECK (service_style IN ('at_center', 'at_home', 'tele')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    activated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(staff_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_services_staff_id ON staff_services(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_services_is_active ON staff_services(is_active);
CREATE INDEX IF NOT EXISTS idx_staff_services_sub_category ON staff_services(sub_category);

-- ============================================
-- SEARCH INDEX TABLE (ENHANCED)
-- ============================================
-- Enhanced search_index table with proper constraints
ALTER TABLE search_index 
ADD COLUMN IF NOT EXISTS entity_type TEXT NOT NULL DEFAULT 'vendor',
ADD COLUMN IF NOT EXISTS entity_id UUID NOT NULL,
ADD COLUMN IF NOT EXISTS search_text TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Create unique constraint if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'search_index_entity_unique'
    ) THEN
        ALTER TABLE search_index 
        ADD CONSTRAINT search_index_entity_unique 
        UNIQUE (entity_type, entity_id);
    END IF;
END $$;

-- Create indexes for search
CREATE INDEX IF NOT EXISTS idx_search_index_entity_type ON search_index(entity_type);
CREATE INDEX IF NOT EXISTS idx_search_index_entity_id ON search_index(entity_id);
CREATE INDEX IF NOT EXISTS idx_search_index_search_vector ON search_index USING gin(search_vector);

-- ============================================
-- PROBLEM GRID MAPPINGS TABLE
-- ============================================
-- Stores problem grid to subcategory mappings (for indexing)
CREATE TABLE IF NOT EXISTS problem_grid_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_id TEXT NOT NULL,
    problem_name TEXT NOT NULL,
    problem_display_name TEXT,
    role_id TEXT NOT NULL,
    sub_category_id TEXT NOT NULL,
    sub_category_name TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(problem_id, sub_category_id)
);

CREATE INDEX IF NOT EXISTS idx_problem_grid_mappings_problem_id ON problem_grid_mappings(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_grid_mappings_role_id ON problem_grid_mappings(role_id);
CREATE INDEX IF NOT EXISTS idx_problem_grid_mappings_sub_category ON problem_grid_mappings(sub_category_id);

-- ============================================
-- TRIGGERS FOR AUTO-INDEXING
-- ============================================

-- Function to update vendor search index
CREATE OR REPLACE FUNCTION update_vendor_search_index()
RETURNS TRIGGER AS $$
BEGIN
    -- Update search index when vendor services change
    PERFORM update_search_index_for_vendor(NEW.vendor_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update staff search index
CREATE OR REPLACE FUNCTION update_staff_search_index()
RETURNS TRIGGER AS $$
BEGIN
    -- Update search index when staff services change
    PERFORM update_search_index_for_staff(NEW.staff_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on vendor_services changes
DROP TRIGGER IF EXISTS trigger_vendor_services_search_index ON vendor_services;
CREATE TRIGGER trigger_vendor_services_search_index
    AFTER INSERT OR UPDATE OR DELETE ON vendor_services
    FOR EACH ROW
    EXECUTE FUNCTION update_vendor_search_index();

-- Trigger on staff_services changes
DROP TRIGGER IF EXISTS trigger_staff_services_search_index ON staff_services;
CREATE TRIGGER trigger_staff_services_search_index
    AFTER INSERT OR UPDATE OR DELETE ON staff_services
    FOR EACH ROW
    EXECUTE FUNCTION update_staff_search_index();

-- ============================================
-- HELPER FUNCTIONS FOR INDEX UPDATES
-- ============================================

-- Function to update search index for vendor
CREATE OR REPLACE FUNCTION update_search_index_for_vendor(p_vendor_id UUID)
RETURNS void AS $$
DECLARE
    v_search_text TEXT;
    v_metadata JSONB;
BEGIN
    -- Build searchable text from vendor and services
    SELECT 
        COALESCE(
            v.business_name || ' ' ||
            v.city || ' ' ||
            v.state || ' ' ||
            string_agg(DISTINCT vs.service_name, ' '),
            v.business_name || ' ' || v.city || ' ' || v.state
        )
    INTO v_search_text
    FROM vendors v
    LEFT JOIN vendor_services vs ON vs.vendor_id = v.id 
        AND vs.publish_status = 'published' 
        AND vs.is_enabled = true
    WHERE v.id = p_vendor_id
    GROUP BY v.id, v.business_name, v.city, v.state;

    -- Build metadata
    SELECT jsonb_build_object(
        'businessName', v.business_name,
        'roleId', v.role_id,
        'serviceCount', COUNT(DISTINCT vs.id),
        'location', jsonb_build_object(
            'city', v.city,
            'state', v.state,
            'address', v.address
        )
    )
    INTO v_metadata
    FROM vendors v
    LEFT JOIN vendor_services vs ON vs.vendor_id = v.id 
        AND vs.publish_status = 'published' 
        AND vs.is_enabled = true
    WHERE v.id = p_vendor_id
    GROUP BY v.id, v.business_name, v.role_id, v.city, v.state, v.address;

    -- Upsert search index
    INSERT INTO search_index (entity_type, entity_id, search_text, metadata, updated_at)
    VALUES ('vendor', p_vendor_id, LOWER(v_search_text), v_metadata, NOW())
    ON CONFLICT (entity_type, entity_id)
    DO UPDATE SET
        search_text = EXCLUDED.search_text,
        metadata = EXCLUDED.metadata,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to update search index for staff
CREATE OR REPLACE FUNCTION update_search_index_for_staff(p_staff_id UUID)
RETURNS void AS $$
DECLARE
    v_search_text TEXT;
    v_metadata JSONB;
BEGIN
    -- Build searchable text from staff and services
    SELECT 
        COALESCE(
            s.full_name || ' ' ||
            COALESCE(s.specialization, '') || ' ' ||
            string_agg(DISTINCT ss.service_name, ' '),
            s.full_name || ' ' || COALESCE(s.specialization, '')
        )
    INTO v_search_text
    FROM staff s
    LEFT JOIN staff_services ss ON ss.staff_id = s.id AND ss.is_active = true
    WHERE s.id = p_staff_id
    GROUP BY s.id, s.full_name, s.specialization;

    -- Build metadata
    SELECT jsonb_build_object(
        'fullName', s.full_name,
        'specialization', s.specialization,
        'vendorId', s.vendor_id,
        'serviceCount', COUNT(DISTINCT ss.id)
    )
    INTO v_metadata
    FROM staff s
    LEFT JOIN staff_services ss ON ss.staff_id = s.id AND ss.is_active = true
    WHERE s.id = p_staff_id
    GROUP BY s.id, s.full_name, s.specialization, s.vendor_id;

    -- Upsert search index
    INSERT INTO search_index (entity_type, entity_id, search_text, metadata, updated_at)
    VALUES ('staff', p_staff_id, LOWER(v_search_text), v_metadata, NOW())
    ON CONFLICT (entity_type, entity_id)
    DO UPDATE SET
        search_text = EXCLUDED.search_text,
        metadata = EXCLUDED.metadata,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE vendor_services IS 'Vendor published services (replaces KV store)';
COMMENT ON TABLE staff_services IS 'Staff active services (replaces KV store)';
COMMENT ON TABLE problem_grid_mappings IS 'Problem grid to subcategory mappings for indexing';
COMMENT ON FUNCTION update_search_index_for_vendor IS 'Updates search index when vendor services change';
COMMENT ON FUNCTION update_search_index_for_staff IS 'Updates search index when staff services change';

