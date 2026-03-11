-- ============================================================================
-- MIGRATION 505: SPECIALIZATION MASTER SCHEMA
-- ============================================================================
-- Date: 2026-01-29
-- Purpose: Create unified master tables for specializations (problem grid)
--          with symptom mappings for 360-degree lifecycle management
-- 
-- Key Design:
--   - Does NOT break existing problem_grid_mappings (reads from it for backfill)
--   - Uses same specialization IDs as existing system
--   - Provides admin UI management capability
--   - Consistent icons from customer-web (Lucide icons)
-- ============================================================================

-- ============================================================================
-- 1. SPECIALIZATION MASTER TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS specialization_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Core Identification (matches existing problem_id in problem_grid_mappings)
    specialization_id TEXT UNIQUE NOT NULL,  -- e.g., 'general_health', 'surgery', 'bath_only'
    
    -- Display Information
    name TEXT NOT NULL,
    display_name TEXT,
    description TEXT,
    short_description TEXT,
    
    -- Category Linkage
    category_id TEXT,  -- Links to service_categories.category_id (veterinary, grooming, etc.)
    
    -- Role Configuration (available to BOTH solo and business by default)
    applicable_roles TEXT[] NOT NULL DEFAULT '{}',  -- ['vet_solo', 'vet_clinic', 'groomer_solo', 'groomer_center']
    
    -- Icon Configuration (from customer-web Lucide icons)
    icon_name TEXT,              -- Lucide icon name: 'Heart', 'Scissors', 'Stethoscope'
    icon_color TEXT,             -- Tailwind color class: 'text-red-500', 'text-blue-500'
    
    -- Display Settings
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    show_in_problem_grid BOOLEAN DEFAULT true,      -- Customer problem grid
    show_in_vendor_profile BOOLEAN DEFAULT true,    -- Vendor specialization selector
    show_in_services_dashboard BOOLEAN DEFAULT true, -- Vendor services dashboard
    
    -- Service Style Configuration
    allowed_service_styles JSONB DEFAULT '["at_home", "at_center", "tele"]'::jsonb,
    
    -- Metadata for extensibility
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for specialization_master
CREATE INDEX IF NOT EXISTS idx_spec_master_category ON specialization_master(category_id);
CREATE INDEX IF NOT EXISTS idx_spec_master_roles ON specialization_master USING GIN(applicable_roles);
CREATE INDEX IF NOT EXISTS idx_spec_master_active ON specialization_master(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_spec_master_problem_grid ON specialization_master(show_in_problem_grid) WHERE show_in_problem_grid = true;
CREATE INDEX IF NOT EXISTS idx_spec_master_vendor_profile ON specialization_master(show_in_vendor_profile) WHERE show_in_vendor_profile = true;

-- ============================================================================
-- 2. SPECIALIZATION SYMPTOMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS specialization_symptoms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Link to specialization
    specialization_id TEXT NOT NULL REFERENCES specialization_master(specialization_id) ON DELETE CASCADE,
    
    -- Symptom Information
    symptom_name TEXT NOT NULL,
    symptom_display_name TEXT,
    
    -- Search Keywords (for customer search)
    symptom_keywords TEXT[] DEFAULT '{}',  -- ['vomit', 'throwing up', 'nausea']
    
    -- Pet Type Filters (optional)
    pet_types TEXT[] DEFAULT '{}',         -- ['dog', 'cat', 'bird'] - empty means all
    
    -- Display
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique symptom per specialization
    UNIQUE(specialization_id, symptom_name)
);

-- Indexes for specialization_symptoms
CREATE INDEX IF NOT EXISTS idx_symptoms_spec ON specialization_symptoms(specialization_id);
CREATE INDEX IF NOT EXISTS idx_symptoms_keywords ON specialization_symptoms USING GIN(symptom_keywords);
CREATE INDEX IF NOT EXISTS idx_symptoms_active ON specialization_symptoms(is_active) WHERE is_active = true;

-- ============================================================================
-- 3. UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_specialization_master_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_specialization_master_updated_at ON specialization_master;
CREATE TRIGGER trigger_specialization_master_updated_at
    BEFORE UPDATE ON specialization_master
    FOR EACH ROW
    EXECUTE FUNCTION update_specialization_master_updated_at();

-- ============================================================================
-- 4. COMMENTS
-- ============================================================================

COMMENT ON TABLE specialization_master IS 'Master table for all specializations (problem grid items), managed via Admin Categories tab';
COMMENT ON TABLE specialization_symptoms IS 'Symptoms/conditions linked to each specialization for customer search and discovery';
COMMENT ON COLUMN specialization_master.specialization_id IS 'Unique text ID matching existing problem_id in problem_grid_mappings';
COMMENT ON COLUMN specialization_master.applicable_roles IS 'Array of role IDs that can select this specialization - both solo and business types';
COMMENT ON COLUMN specialization_master.icon_name IS 'Lucide React icon name (e.g., Heart, Scissors, Stethoscope)';
COMMENT ON COLUMN specialization_master.icon_color IS 'Tailwind CSS color class (e.g., text-red-500, text-blue-500)';

-- ============================================================================
-- END OF MIGRATION 505
-- ============================================================================
