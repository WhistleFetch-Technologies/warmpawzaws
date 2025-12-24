-- Migration: Create cafe_tables table for SQL-only table management
-- Replaces KV store usage for cafe table inventory

CREATE TABLE IF NOT EXISTS cafe_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    table_number TEXT NOT NULL,
    name TEXT,
    capacity INTEGER NOT NULL, -- PAX capacity (2, 4, 6, 8)
    section TEXT DEFAULT 'Main Area', -- Indoor, Outdoor, Patio, etc.
    location TEXT DEFAULT 'Indoor', -- Indoor, Outdoor, Patio
    is_outdoor BOOLEAN DEFAULT false,
    amenities JSONB DEFAULT '[]'::jsonb, -- Window view, Pet-friendly cushions, etc.
    status TEXT DEFAULT 'available', -- available, occupied, reserved, maintenance
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(vendor_id, table_number)
);

CREATE INDEX IF NOT EXISTS idx_cafe_tables_vendor_id ON cafe_tables(vendor_id);
CREATE INDEX IF NOT EXISTS idx_cafe_tables_status ON cafe_tables(status) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cafe_tables_vendor_status ON cafe_tables(vendor_id, status) WHERE is_active = true;

