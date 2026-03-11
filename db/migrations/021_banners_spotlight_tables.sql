-- ============================================================================
-- BANNERS & SPOTLIGHT OFFERS TABLES
-- ============================================================================
-- Date: 2025-01-22
-- Purpose: SQL tables for banners and spotlight offers management
-- Replaces: KV keys content:banner:* and spotlight offers hardcoded data
-- ============================================================================

-- Banners table
CREATE TABLE IF NOT EXISTS banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('main', 'spotlight', 'category', 'service')),
    title TEXT NOT NULL,
    subtitle TEXT,
    image_url TEXT, -- S3 URL
    cta_text TEXT,
    cta_link TEXT,
    metadata JSONB, -- For bg gradients, emoji, additional config
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    target_role_id TEXT, -- Optional: role-specific banners
    target_service_category TEXT, -- Optional: category-specific banners
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banners_type ON banners(type);
CREATE INDEX IF NOT EXISTS idx_banners_active ON banners(is_active);
CREATE INDEX IF NOT EXISTS idx_banners_dates ON banners(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_banners_role ON banners(target_role_id) WHERE target_role_id IS NOT NULL;

-- Banner analytics (views and clicks tracking)
CREATE TABLE IF NOT EXISTS banner_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    banner_id UUID NOT NULL REFERENCES banners(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    event_type TEXT NOT NULL CHECK (event_type IN ('view', 'click')),
    user_agent TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banner_analytics_banner ON banner_analytics(banner_id);
CREATE INDEX IF NOT EXISTS idx_banner_analytics_customer ON banner_analytics(customer_id);
CREATE INDEX IF NOT EXISTS idx_banner_analytics_event ON banner_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_banner_analytics_created ON banner_analytics(created_at);

-- Spotlight offers table
CREATE TABLE IF NOT EXISTS spotlight_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id TEXT NOT NULL, -- 'veterinarian', 'groomer', etc.
    service_category TEXT, -- Optional: specific service category
    title TEXT NOT NULL,
    subtitle TEXT,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'free')),
    discount_value NUMERIC(10, 2),
    badge_text TEXT, -- e.g., "Limited Time", "First Visit"
    icon TEXT, -- Icon name or emoji
    image_url TEXT, -- S3 URL (optional)
    cta_text TEXT DEFAULT 'Book Now',
    cta_link TEXT, -- Navigation target
    metadata JSONB, -- For additional styling/config
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spotlight_offers_role ON spotlight_offers(role_id);
CREATE INDEX IF NOT EXISTS idx_spotlight_offers_active ON spotlight_offers(is_active);
CREATE INDEX IF NOT EXISTS idx_spotlight_offers_dates ON spotlight_offers(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_spotlight_offers_category ON spotlight_offers(service_category) WHERE service_category IS NOT NULL;

-- Spotlight offer analytics
CREATE TABLE IF NOT EXISTS spotlight_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spotlight_id UUID NOT NULL REFERENCES spotlight_offers(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    event_type TEXT NOT NULL CHECK (event_type IN ('view', 'click', 'apply')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spotlight_analytics_spotlight ON spotlight_analytics(spotlight_id);
CREATE INDEX IF NOT EXISTS idx_spotlight_analytics_customer ON spotlight_analytics(customer_id);
CREATE INDEX IF NOT EXISTS idx_spotlight_analytics_event ON spotlight_analytics(event_type);

COMMENT ON TABLE banners IS 'Marketing banners displayed in customer app (main carousel, category-specific, etc.)';
COMMENT ON TABLE banner_analytics IS 'Banner view and click tracking';
COMMENT ON TABLE spotlight_offers IS 'Spotlight/promotional offers shown on service landing pages';
COMMENT ON TABLE spotlight_analytics IS 'Spotlight offer view, click, and apply tracking';

