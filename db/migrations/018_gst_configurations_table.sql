-- ============================================================================
-- MIGRATION 018: GST Configurations Table
-- ============================================================================
-- Date: 2024-12-23
-- Purpose: Create GST configurations table for tax management
-- Migration: Phase 1, Task 1.2 - KV to SQL
-- ============================================================================

CREATE TABLE IF NOT EXISTS gst_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hsn_code TEXT,
    category TEXT,
    gst_rate NUMERIC(5, 2) NOT NULL,
    cgst_rate NUMERIC(5, 2),
    sgst_rate NUMERIC(5, 2),
    igst_rate NUMERIC(5, 2),
    applicable_states JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gst_configurations_hsn_code ON gst_configurations(hsn_code);
CREATE INDEX IF NOT EXISTS idx_gst_configurations_category ON gst_configurations(category);
CREATE INDEX IF NOT EXISTS idx_gst_configurations_active ON gst_configurations(is_active);

COMMENT ON TABLE gst_configurations IS 'GST tax configurations - replaces platform:gst_configs KV keys';

