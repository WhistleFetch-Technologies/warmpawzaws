-- ============================================================================
-- MIGRATION 034: Vendor Specializations Table
-- ============================================================================
-- Date: 2025-01-27
-- Purpose: Create vendor_specializations table for many-to-many relationship
-- ============================================================================

-- Vendor Specializations (many-to-many)
-- Maps: vendor:{vendorId} specializations array
CREATE TABLE IF NOT EXISTS vendor_specializations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    specialization TEXT NOT NULL, -- Problem grid ID (e.g., 'surgery', 'cardiology')
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(vendor_id, specialization)
);

CREATE INDEX IF NOT EXISTS idx_vendor_specializations_vendor ON vendor_specializations(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_specializations_spec ON vendor_specializations(specialization);

COMMENT ON TABLE vendor_specializations IS 'Vendor specializations - many-to-many relationship with problem grid IDs';

