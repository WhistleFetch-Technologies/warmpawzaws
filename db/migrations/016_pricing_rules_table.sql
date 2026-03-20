-- ============================================================================
-- MIGRATION 016: Pricing Rules Table
-- ============================================================================
-- Date: 2025-01-28
-- Purpose: Create table for boarding pricing rules (replaces vendor:{id}:boarding_pricing KV)
-- ============================================================================

CREATE TABLE IF NOT EXISTS pricing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES boarding_rooms(id) ON DELETE CASCADE,
    room_name TEXT NOT NULL,
    base_night_price NUMERIC(10, 2) NOT NULL,
    size_based_pricing JSONB DEFAULT '{}'::jsonb, -- {small, medium, large, extraLarge}
    seasonal_pricing JSONB DEFAULT '[]'::jsonb,
    special_offers JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pricing_rules_vendor_id ON pricing_rules(vendor_id);
CREATE INDEX idx_pricing_rules_room_id ON pricing_rules(room_id);
CREATE INDEX idx_pricing_rules_active ON pricing_rules(vendor_id) WHERE is_active = true;

COMMENT ON TABLE pricing_rules IS 'Boarding pricing rules per vendor/room - replaces vendor:{id}:boarding_pricing KV keys';

