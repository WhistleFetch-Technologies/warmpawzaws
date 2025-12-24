-- ============================================================================
-- MIGRATION 015: Boarding Rooms Table
-- ============================================================================
-- Date: 2025-01-28
-- Purpose: Create table for boarding rooms (replaces vendor:{id}:boarding_rooms KV)
-- ============================================================================

CREATE TABLE IF NOT EXISTS boarding_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    day_price NUMERIC(10, 2) NOT NULL,
    night_price NUMERIC(10, 2) NOT NULL,
    capacity INTEGER DEFAULT 1,
    pet_types TEXT[] DEFAULT ARRAY['dog', 'cat'],
    amenities JSONB DEFAULT '[]'::jsonb,
    included JSONB DEFAULT '[]'::jsonb,
    not_included JSONB DEFAULT '[]'::jsonb,
    photos TEXT[] DEFAULT '{}',
    videos TEXT[] DEFAULT '{}',
    size TEXT,
    features TEXT,
    rules TEXT,
    is_active BOOLEAN DEFAULT true,
    total_units INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_boarding_rooms_vendor_id ON boarding_rooms(vendor_id);
CREATE INDEX idx_boarding_rooms_active ON boarding_rooms(vendor_id) WHERE is_active = true;

COMMENT ON TABLE boarding_rooms IS 'Boarding rooms per vendor - replaces vendor:{id}:boarding_rooms KV keys';

