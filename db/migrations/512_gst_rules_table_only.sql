-- ============================================================================
-- 512: Create gst_rules table only (for seed compatibility)
-- ============================================================================
-- Use when full 008 cannot be run. role_id FK optional via column only if roles exists.
-- ============================================================================

CREATE TABLE IF NOT EXISTS gst_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 100,
    role_id UUID,
    service_style TEXT CHECK (service_style IN ('at_center', 'at_home', 'tele', 'hybrid')),
    category TEXT,
    min_amount NUMERIC(10, 2),
    max_amount NUMERIC(10, 2),
    customer_state TEXT,
    vendor_state TEXT,
    gst_type TEXT NOT NULL CHECK (gst_type IN ('percentage', 'fixed')) DEFAULT 'percentage',
    gst_rate NUMERIC(5, 2) NOT NULL CHECK (gst_rate >= 0 AND gst_rate <= 100),
    cgst_percentage NUMERIC(5, 2),
    sgst_percentage NUMERIC(5, 2),
    igst_percentage NUMERIC(5, 2),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gst_rules_priority ON gst_rules(priority) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_gst_rules_role_service ON gst_rules(role_id, service_style) WHERE enabled = true;
COMMENT ON TABLE gst_rules IS 'GST rules by service style / category';
