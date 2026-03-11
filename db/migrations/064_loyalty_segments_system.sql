-- ============================================================================
-- MIGRATION 064: Loyalty Segments System
-- ============================================================================
-- Date: 2025-01-12
-- Purpose: Create segmentation system for loyalty rules
-- ============================================================================

-- Loyalty Segments
-- Defines customer/vendor segments that can be used in loyalty rules
CREATE TABLE IF NOT EXISTS loyalty_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_name TEXT NOT NULL UNIQUE,
    segment_type TEXT NOT NULL CHECK (segment_type IN ('customer', 'vendor', 'both')),
    description TEXT,
    
    -- Segment Criteria (JSONB)
    -- Supports multiple criteria types:
    -- - service_categories: ["category-id-1", "category-name"]
    -- - customer_tiers: ["gold", "platinum"]
    -- - purchase_history: { min_purchases: 5, min_amount: 10000 }
    -- - registration_date: { before: "2024-01-01", after: "2023-01-01" }
    -- - pet_count: { min: 1, max: 5 }
    -- - location: { cities: ["Mumbai", "Delhi"], states: ["Maharashtra"] }
    -- - vendor_ids: ["vendor-uuid-1", "vendor-uuid-2"]
    -- - service_types: ["at_vendor", "at_home", "online"]
    criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Evaluation Logic
    -- 'all' = all criteria must match (AND)
    -- 'any' = any criteria must match (OR)
    match_type TEXT NOT NULL DEFAULT 'all' CHECK (match_type IN ('all', 'any')),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 100, -- Higher priority segments evaluated first
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer Segment Assignments (cached for performance)
-- This table caches which segment each customer belongs to
-- Updated when segment criteria change or customer data changes
CREATE TABLE IF NOT EXISTS customer_segment_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    segment_id UUID NOT NULL REFERENCES loyalty_segments(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- For time-based segments
    is_active BOOLEAN DEFAULT true,
    
    UNIQUE(customer_id, segment_id)
);

-- Vendor Segment Assignments (cached for performance)
CREATE TABLE IF NOT EXISTS vendor_segment_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    segment_id UUID NOT NULL REFERENCES loyalty_segments(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    
    UNIQUE(vendor_id, segment_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_loyalty_segments_name ON loyalty_segments(segment_name);
CREATE INDEX IF NOT EXISTS idx_loyalty_segments_type ON loyalty_segments(segment_type);
CREATE INDEX IF NOT EXISTS idx_loyalty_segments_active ON loyalty_segments(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_loyalty_segments_priority ON loyalty_segments(priority DESC) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_customer_segment_assignments_customer ON customer_segment_assignments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_segment_assignments_segment ON customer_segment_assignments(segment_id);
CREATE INDEX IF NOT EXISTS idx_customer_segment_assignments_active ON customer_segment_assignments(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_vendor_segment_assignments_vendor ON vendor_segment_assignments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_segment_assignments_segment ON vendor_segment_assignments(segment_id);
CREATE INDEX IF NOT EXISTS idx_vendor_segment_assignments_active ON vendor_segment_assignments(is_active) WHERE is_active = true;

-- Comments
COMMENT ON TABLE loyalty_segments IS 'Customer/vendor segments for loyalty rule targeting';
COMMENT ON COLUMN loyalty_segments.criteria IS 'JSONB criteria for segment membership (service_categories, customer_tiers, purchase_history, etc.)';
COMMENT ON COLUMN loyalty_segments.match_type IS 'Evaluation logic: all (AND) or any (OR)';
COMMENT ON TABLE customer_segment_assignments IS 'Cached customer segment memberships for performance';
COMMENT ON TABLE vendor_segment_assignments IS 'Cached vendor segment memberships for performance';

-- Update loyalty_action_rules to support segment-based conditions
-- Add segment_ids to conditions JSONB (in addition to existing fields)
-- Example: conditions = '{"segment_ids": ["segment-uuid-1", "segment-uuid-2"]}'

-- Insert default segments based on common use cases
INSERT INTO loyalty_segments (segment_name, segment_type, description, criteria, match_type, priority) VALUES
-- Category-based segments
('Medicine Buyers', 'customer', 'Customers who purchase medicines', '{"service_categories": ["Medicine"]}'::jsonb, 'any', 100),
('Grooming Service Users', 'customer', 'Customers who book grooming services', '{"service_categories": ["Grooming"]}'::jsonb, 'any', 100),
('Vet Consultation Users', 'customer', 'Customers who book vet consultations', '{"service_categories": ["Veterinary", "Consultation"]}'::jsonb, 'any', 100),
('Pet Food Buyers', 'customer', 'Customers who purchase pet food', '{"service_categories": ["Pet Food", "Food"]}'::jsonb, 'any', 100),
('Insurance Buyers', 'customer', 'Customers who purchase pet insurance', '{"service_categories": ["Insurance"]}'::jsonb, 'any', 100),

-- Tier-based segments
('Gold Tier Customers', 'customer', 'Gold tier loyalty customers', '{"customer_tiers": ["gold"]}'::jsonb, 'any', 150),
('Platinum Tier Customers', 'customer', 'Platinum tier loyalty customers', '{"customer_tiers": ["platinum"]}'::jsonb, 'any', 150),

-- Behavior-based segments
('First Time Buyers', 'customer', 'Customers making their first purchase', '{"first_purchase": true}'::jsonb, 'all', 200),
('Birthday Month Customers', 'customer', 'Customers with pets having birthday this month', '{"birthday_month": true}'::jsonb, 'all', 200),
('Regular Customers', 'customer', 'Customers with 5+ purchases', '{"purchase_history": {"min_purchases": 5}}'::jsonb, 'all', 100),
('High Value Customers', 'customer', 'Customers with ₹10,000+ lifetime spend', '{"purchase_history": {"min_amount": 10000}}'::jsonb, 'all', 150),

-- Service type segments
('Doorstep Service Users', 'customer', 'Customers who use doorstep services', '{"service_types": ["at_home"]}'::jsonb, 'any', 100),
('In-Clinic Service Users', 'customer', 'Customers who use in-clinic services', '{"service_types": ["at_vendor"]}'::jsonb, 'any', 100),
('Online Service Users', 'customer', 'Customers who use online services', '{"service_types": ["online"]}'::jsonb, 'any', 100)
ON CONFLICT (segment_name) DO NOTHING;
