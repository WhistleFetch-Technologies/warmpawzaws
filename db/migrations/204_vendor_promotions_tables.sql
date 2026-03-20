-- ============================================================================
-- VENDOR PROMOTIONS TABLES
-- ============================================================================
-- Date: 2026-01-20
-- Purpose: Create tables for vendor-level promotions (products and services)
-- ============================================================================

-- Vendor Product Promotions (for Sellers)
CREATE TABLE IF NOT EXISTS vendor_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    -- Basic Info
    name TEXT NOT NULL,
    description TEXT,
    code TEXT, -- Coupon code (optional, uppercase)
    
    -- Promotion Type
    promotion_type TEXT NOT NULL DEFAULT 'flash_sale' CHECK (
        promotion_type IN ('flash_sale', 'seasonal', 'buy_x_get_y', 'bundle', 'first_order', 'category_discount', 'loyalty')
    ),
    
    -- Discount Configuration
    discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC(10, 2) NOT NULL DEFAULT 0,
    min_order_value NUMERIC(10, 2),
    max_discount_amount NUMERIC(10, 2),
    
    -- Validity
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    
    -- Usage Limits
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    
    -- Target Audience
    target_audience TEXT DEFAULT 'all' CHECK (target_audience IN ('all', 'new_users', 'returning_users')),
    
    -- Applicable Products/Categories (JSONB arrays)
    applicable_products JSONB, -- Array of product IDs
    applicable_categories JSONB, -- Array of category names
    
    -- BOGO (Buy X Get Y) specific
    buy_quantity INTEGER,
    get_quantity INTEGER,
    get_discount_percent INTEGER,
    
    -- Bundle specific
    bundle_products JSONB, -- Array of product IDs for combo
    bundle_discount NUMERIC(5, 2),
    
    -- Analytics
    views INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    revenue_generated NUMERIC(12, 2) DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendor Service Promotions (for Service Providers)
CREATE TABLE IF NOT EXISTS vendor_service_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    -- Basic Info
    name TEXT NOT NULL,
    description TEXT,
    code TEXT, -- Coupon code (optional, uppercase)
    
    -- Promotion Type
    promotion_type TEXT NOT NULL DEFAULT 'flash_sale' CHECK (
        promotion_type IN ('flash_sale', 'seasonal', 'first_booking', 'combo', 'loyalty', 'service_specific')
    ),
    
    -- Discount Configuration
    discount_type TEXT DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC(10, 2),
    min_booking_value NUMERIC(10, 2),
    max_discount_amount NUMERIC(10, 2),
    
    -- Validity
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    
    -- Usage Limits
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    
    -- Target Audience
    target_audience TEXT DEFAULT 'all' CHECK (target_audience IN ('all', 'new_users', 'returning_users')),
    
    -- Applicable Services/Styles (JSONB arrays)
    applicable_services JSONB, -- Array of service IDs
    applicable_service_styles JSONB, -- Array like ['at_home', 'at_center', 'tele']
    
    -- Combo specific
    combo_services JSONB, -- Array of service IDs for combo
    combo_discount NUMERIC(5, 2),
    
    -- Loyalty specific
    visits_required INTEGER,
    loyalty_discount NUMERIC(5, 2),
    
    -- Analytics
    views INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    revenue_generated NUMERIC(12, 2) DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Promotion Usage Tracking
CREATE TABLE IF NOT EXISTS promotion_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id UUID NOT NULL,
    promotion_type TEXT NOT NULL, -- 'product', 'service', 'platform'
    
    -- Association
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    
    -- Details
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    original_amount NUMERIC(10, 2),
    final_amount NUMERIC(10, 2),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_vendor_promotions_vendor ON vendor_promotions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_promotions_code ON vendor_promotions(code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendor_promotions_active ON vendor_promotions(is_active, start_date, end_date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_vendor_promotions_type ON vendor_promotions(promotion_type);

CREATE INDEX IF NOT EXISTS idx_vendor_service_promotions_vendor ON vendor_service_promotions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_service_promotions_code ON vendor_service_promotions(code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendor_service_promotions_active ON vendor_service_promotions(is_active, start_date, end_date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_vendor_service_promotions_type ON vendor_service_promotions(promotion_type);

CREATE INDEX IF NOT EXISTS idx_promotion_usages_promotion ON promotion_usages(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usages_customer ON promotion_usages(customer_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usages_booking ON promotion_usages(booking_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usages_order ON promotion_usages(order_id);

-- Add unique constraint on code per vendor
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_promotions_unique_code 
    ON vendor_promotions(vendor_id, code) WHERE code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_service_promotions_unique_code 
    ON vendor_service_promotions(vendor_id, code) WHERE code IS NOT NULL;

-- Add published column to existing promotions table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promotions' AND column_name = 'published') THEN
        ALTER TABLE promotions ADD COLUMN published BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promotions' AND column_name = 'is_spotlight') THEN
        ALTER TABLE promotions ADD COLUMN is_spotlight BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promotions' AND column_name = 'priority') THEN
        ALTER TABLE promotions ADD COLUMN priority INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promotions' AND column_name = 'applicable_services') THEN
        ALTER TABLE promotions ADD COLUMN applicable_services JSONB;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promotions' AND column_name = 'code') THEN
        ALTER TABLE promotions ADD COLUMN code TEXT;
    END IF;
END $$;

-- Grant permissions (wrapped in DO block to handle missing roles gracefully)
DO $$ 
BEGIN
    -- Try to grant permissions to authenticated role (Supabase)
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON vendor_promotions TO authenticated;
        GRANT SELECT, INSERT, UPDATE, DELETE ON vendor_service_promotions TO authenticated;
        GRANT SELECT, INSERT, UPDATE, DELETE ON promotion_usages TO authenticated;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if role doesn't exist
    NULL;
END $$;
