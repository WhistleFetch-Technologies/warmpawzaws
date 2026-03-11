-- ============================================================================
-- MIGRATION 029: Vendor Portfolio Table
-- ============================================================================
-- Date: 2025-01-27
-- Purpose: Create vendor_portfolio table to replace KV store portfolio keys
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_portfolio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('grooming', 'training', 'medical', 'event', 'boarding', 'daycare', 'other')),
    images JSONB DEFAULT '[]'::jsonb,
    tags JSONB DEFAULT '[]'::jsonb,
    pet_type TEXT,
    pet_breed TEXT,
    completed_date DATE NOT NULL,
    featured BOOLEAN DEFAULT false,
    client_testimonial TEXT,
    client_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vendor_portfolio_vendor ON vendor_portfolio(vendor_id);
CREATE INDEX idx_vendor_portfolio_featured ON vendor_portfolio(vendor_id, featured) WHERE featured = true;
CREATE INDEX idx_vendor_portfolio_category ON vendor_portfolio(category);
CREATE INDEX idx_vendor_portfolio_completed_date ON vendor_portfolio(completed_date DESC);

COMMENT ON TABLE vendor_portfolio IS 'Vendor portfolio items - maps from portfolio:{vendorId}:{itemId} KV keys';
COMMENT ON COLUMN vendor_portfolio.images IS 'Array of image URLs';
COMMENT ON COLUMN vendor_portfolio.tags IS 'Array of tag strings';

