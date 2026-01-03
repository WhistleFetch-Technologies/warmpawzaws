-- ============================================================================
-- CAFE TABLES AND BOARDING ROOMS
-- ============================================================================
-- Additional tables for specialized vendor configurations:
-- - Cafe table management
-- - Boarding room configuration
-- ============================================================================

-- Cafe Tables
CREATE TABLE IF NOT EXISTS cafe_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    table_number TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 2,
    section TEXT, -- indoor, outdoor, etc.
    location TEXT,
    is_outdoor BOOLEAN DEFAULT false,
    amenities JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'maintenance')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(vendor_id, table_number)
);

CREATE INDEX IF NOT EXISTS idx_cafe_tables_vendor_id ON cafe_tables(vendor_id);
CREATE INDEX IF NOT EXISTS idx_cafe_tables_status ON cafe_tables(status);

-- Boarding Rooms
CREATE TABLE IF NOT EXISTS boarding_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    room_number TEXT NOT NULL,
    room_type TEXT DEFAULT 'standard' CHECK (room_type IN ('standard', 'deluxe', 'premium', 'suite')),
    capacity INTEGER DEFAULT 1, -- Number of pets
    amenities JSONB DEFAULT '[]'::jsonb,
    price_per_night NUMERIC(10, 2) NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(vendor_id, room_number)
);

CREATE INDEX IF NOT EXISTS idx_boarding_rooms_vendor_id ON boarding_rooms(vendor_id);
CREATE INDEX IF NOT EXISTS idx_boarding_rooms_available ON boarding_rooms(is_available);
CREATE INDEX IF NOT EXISTS idx_boarding_rooms_type ON boarding_rooms(room_type);

-- Updated timestamp triggers
CREATE TRIGGER trigger_update_cafe_tables_updated_at
    BEFORE UPDATE ON cafe_tables
    FOR EACH ROW
    EXECUTE FUNCTION update_vendor_specialized_config_updated_at();

CREATE TRIGGER trigger_update_boarding_rooms_updated_at
    BEFORE UPDATE ON boarding_rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_vendor_specialized_config_updated_at();

