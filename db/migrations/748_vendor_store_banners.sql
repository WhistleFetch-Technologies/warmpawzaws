-- ============================================================================
-- VENDOR STORE BANNERS (seller storefront promotional banners)
-- ============================================================================
-- Date: 2026-05-08
-- Purpose: Persist banners managed from vendor-web Banner Management
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_store_banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT NOT NULL,
    link_url TEXT,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_store_banners_vendor ON vendor_store_banners(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_store_banners_active ON vendor_store_banners(vendor_id, is_active);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON vendor_store_banners TO authenticated;
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
