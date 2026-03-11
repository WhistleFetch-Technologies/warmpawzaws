-- ============================================================================
-- MIGRATION 030: Groomer Gallery Table
-- ============================================================================
-- Date: 2025-01-27
-- Purpose: Create groomer_gallery table to store before/after photos from bookings
-- ============================================================================

CREATE TABLE IF NOT EXISTS groomer_gallery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    pet_id UUID REFERENCES pets(id) ON DELETE SET NULL,
    pet_name TEXT,
    service_name TEXT,
    before_photo TEXT, -- URL or base64
    after_photo TEXT, -- URL or base64
    description TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    is_public BOOLEAN DEFAULT false,
    is_portfolio BOOLEAN DEFAULT false, -- If true, also appears in vendor portfolio
    likes INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_groomer_gallery_vendor ON groomer_gallery(vendor_id);
CREATE INDEX idx_groomer_gallery_booking ON groomer_gallery(booking_id);
CREATE INDEX idx_groomer_gallery_portfolio ON groomer_gallery(vendor_id, is_portfolio) WHERE is_portfolio = true;
CREATE INDEX idx_groomer_gallery_public ON groomer_gallery(vendor_id, is_public) WHERE is_public = true;
CREATE INDEX idx_groomer_gallery_uploaded ON groomer_gallery(uploaded_at DESC);

COMMENT ON TABLE groomer_gallery IS 'Groomer gallery photos - before/after photos from completed bookings';
COMMENT ON COLUMN groomer_gallery.before_photo IS 'URL or base64 encoded image';
COMMENT ON COLUMN groomer_gallery.after_photo IS 'URL or base64 encoded image';
COMMENT ON COLUMN groomer_gallery.tags IS 'Array of tag strings';
COMMENT ON COLUMN groomer_gallery.is_portfolio IS 'If true, photo also appears in vendor portfolio';

