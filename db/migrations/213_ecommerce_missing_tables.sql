-- ============================================================================
-- ECOMMERCE MISSING TABLES & FIXES
-- ============================================================================
-- Migration: 213 - E-commerce gaps fix
-- Date: 2026-01-20
-- 
-- Fixes for:
-- 1. Tax categories and HSN codes tables
-- 2. Customers table creation endpoint support
-- 3. Settlement tables for e-commerce orders
-- ============================================================================

-- ============================================================================
-- 1. TAX CATEGORIES TABLE (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tax_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    default_gst_rate NUMERIC(5, 2) DEFAULT 18.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default tax categories
INSERT INTO tax_categories (name, description, default_gst_rate) VALUES
    ('Pet Food', 'Pet food and animal feed products', 18.00),
    ('Pet Accessories', 'Collars, leashes, beds, toys', 18.00),
    ('Pet Medicines', 'Veterinary medicines and treatments', 12.00),
    ('Pet Grooming', 'Shampoos, conditioners, grooming tools', 18.00),
    ('Pet Clothing', 'Pet apparel and costumes', 12.00),
    ('Services', 'Pet care services like grooming, training', 18.00)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 2. HSN CODES TABLE (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS hsn_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    gst_rate NUMERIC(5, 2) NOT NULL,
    category_id UUID REFERENCES tax_categories(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert common HSN codes for pet products
INSERT INTO hsn_codes (code, description, gst_rate) VALUES
    ('2309', 'Preparations of a kind used in animal feeding', 18.00),
    ('9503', 'Toys, games and sports requisites', 18.00),
    ('9401', 'Seats (excluding those of heading 94.02), whether or not convertible into beds', 18.00),
    ('9403', 'Other furniture and parts thereof', 18.00),
    ('9404', 'Mattress supports; articles of bedding', 18.00),
    ('4201', 'Saddlery and harness for any animal', 18.00),
    ('4202', 'Trunks, suit-cases, vanity-cases', 18.00),
    ('3004', 'Medicaments for therapeutic or prophylactic uses', 12.00),
    ('3303', 'Perfumes and toilet waters', 18.00),
    ('3305', 'Preparations for use on the hair', 18.00),
    ('6110', 'Jerseys, pullovers, cardigans', 12.00),
    ('6114', 'Other garments, knitted or crocheted', 12.00),
    ('9996', 'Services - Other services', 18.00)
ON CONFLICT (code) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_hsn_codes_code ON hsn_codes(code);

-- ============================================================================
-- 3. ENSURE CUSTOMERS TABLE HAS REQUIRED COLUMNS
-- ============================================================================

-- Add phone uniqueness constraint if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'customers_phone_unique'
    ) THEN
        -- First check if phone column exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'customers' AND column_name = 'phone'
        ) THEN
            ALTER TABLE customers ADD CONSTRAINT customers_phone_unique UNIQUE (phone);
        END IF;
    END IF;
EXCEPTION WHEN others THEN
    -- Ignore if constraint already exists or phone is null
    NULL;
END $$;

-- ============================================================================
-- 4. SETTLEMENTS FOR E-COMMERCE ORDERS
-- ============================================================================

-- Add e-commerce order support to settlements
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'settlements' AND column_name = 'order_type'
    ) THEN
        ALTER TABLE settlements ADD COLUMN order_type VARCHAR(50) DEFAULT 'booking';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'settlements' AND column_name = 'logistics_amount'
    ) THEN
        ALTER TABLE settlements ADD COLUMN logistics_amount NUMERIC(10, 2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'settlements' AND column_name = 'referral_commission'
    ) THEN
        ALTER TABLE settlements ADD COLUMN referral_commission NUMERIC(10, 2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'settlements' AND column_name = 'fulfillment_type'
    ) THEN
        ALTER TABLE settlements ADD COLUMN fulfillment_type VARCHAR(50);
    END IF;
END $$;

-- ============================================================================
-- 5. ENSURE ECOMMERCE_ORDERS TABLE EXISTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS ecommerce_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE,
    customer_id UUID REFERENCES customers(id),
    vendor_id UUID REFERENCES vendors(id),
    
    -- Order details
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(10, 2) NOT NULL,
    shipping_amount NUMERIC(10, 2) DEFAULT 0,
    tax_amount NUMERIC(10, 2) DEFAULT 0,
    discount_amount NUMERIC(10, 2) DEFAULT 0,
    total_amount NUMERIC(10, 2) NOT NULL,
    
    -- Shipping info
    shipping_address JSONB,
    billing_address JSONB,
    
    -- Payment
    payment_method VARCHAR(50), -- 'cod', 'online', 'wallet'
    payment_status VARCHAR(50) DEFAULT 'pending',
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    
    -- Fulfillment
    fulfillment_type VARCHAR(50) DEFAULT 'warmpawz', -- 'warmpawz', 'self'
    status VARCHAR(50) DEFAULT 'pending',
    
    -- Tracking
    awb_number VARCHAR(100),
    tracking_url TEXT,
    carrier VARCHAR(100),
    
    -- Timestamps
    ordered_at TIMESTAMPTZ DEFAULT NOW(),
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ecommerce_orders_customer ON ecommerce_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_ecommerce_orders_vendor ON ecommerce_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_ecommerce_orders_status ON ecommerce_orders(status);
CREATE INDEX IF NOT EXISTS idx_ecommerce_orders_number ON ecommerce_orders(order_number);

-- ============================================================================
-- 6. PRODUCT STOCK ALERTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_stock_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    threshold INTEGER DEFAULT 10,
    current_stock INTEGER,
    alert_sent BOOLEAN DEFAULT false,
    alert_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_alerts_vendor ON product_stock_alerts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_product ON product_stock_alerts(product_id);

-- ============================================================================
-- 7. ENSURE ROLES TABLE HAS REQUIRED DATA
-- ============================================================================

-- Insert default e-commerce seller role if not exists
INSERT INTO roles (name, display_name, description, is_active, config) VALUES
    ('ecommerce_seller', 'E-Commerce Seller', 'Vendor who sells products online', true, 
     '{"vendorTypes": ["solo", "business"], "capabilities": ["products:manage", "orders:manage", "analytics:view"]}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 8. PROMOTIONS TABLE ENHANCEMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'percentage', 'flat', 'bogo', 'combo'
    
    -- Discount details
    discount_value NUMERIC(10, 2),
    min_order_value NUMERIC(10, 2),
    max_discount NUMERIC(10, 2),
    
    -- BOGO specifics
    buy_quantity INTEGER,
    get_quantity INTEGER,
    
    -- Combo specifics
    combo_products JSONB, -- array of product IDs
    combo_price NUMERIC(10, 2),
    original_price NUMERIC(10, 2),
    
    -- Applicability
    product_ids JSONB, -- array of product IDs (null = all products)
    category_ids JSONB, -- array of category IDs
    applicable_services JSONB DEFAULT '["ecommerce"]'::jsonb,
    
    -- Dates
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    published BOOLEAN DEFAULT false,
    is_spotlight BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active, published);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(start_date, end_date);

-- ============================================================================
-- 9. COUPONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL, -- 'percentage', 'flat'
    discount_value NUMERIC(10, 2) NOT NULL,
    min_order_value NUMERIC(10, 2),
    max_discount NUMERIC(10, 2),
    max_uses INTEGER,
    uses_per_customer INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active);

-- ============================================================================
-- 10. COUPON USAGE TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS coupon_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID REFERENCES coupons(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    order_id UUID,
    discount_applied NUMERIC(10, 2),
    used_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(coupon_id, customer_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_coupon_usage_customer ON coupon_usage(customer_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon ON coupon_usage(coupon_id);

-- ============================================================================
-- 11. UPDATED_AT TRIGGERS
-- ============================================================================

-- Generic trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to new tables
DROP TRIGGER IF EXISTS trg_tax_categories_updated_at ON tax_categories;
CREATE TRIGGER trg_tax_categories_updated_at
    BEFORE UPDATE ON tax_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_hsn_codes_updated_at ON hsn_codes;
CREATE TRIGGER trg_hsn_codes_updated_at
    BEFORE UPDATE ON hsn_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_ecommerce_orders_updated_at ON ecommerce_orders;
CREATE TRIGGER trg_ecommerce_orders_updated_at
    BEFORE UPDATE ON ecommerce_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_promotions_updated_at ON promotions;
CREATE TRIGGER trg_promotions_updated_at
    BEFORE UPDATE ON promotions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_coupons_updated_at ON coupons;
CREATE TRIGGER trg_coupons_updated_at
    BEFORE UPDATE ON coupons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DONE
-- ============================================================================
