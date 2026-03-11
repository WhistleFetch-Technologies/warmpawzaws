-- ============================================================================
-- MIGRATION 210: E-Commerce Enhancements
-- ============================================================================
-- Purpose: Add tables for product reviews, recommendations, and invoice generation
-- Date: 2026-01-20
-- ============================================================================

-- ============================================================================
-- PRODUCT REVIEWS
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    order_item_id UUID,
    
    -- Review content
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title TEXT,
    review TEXT,
    photos JSONB DEFAULT '[]',
    
    -- Verification
    verified_purchase BOOLEAN DEFAULT false,
    
    -- Engagement
    helpful_count INTEGER DEFAULT 0,
    
    -- Moderation
    status TEXT DEFAULT 'published' CHECK (status IN ('pending', 'published', 'hidden', 'rejected')),
    moderation_note TEXT,
    moderated_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_customer ON product_reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_status ON product_reviews(status);
CREATE INDEX IF NOT EXISTS idx_product_reviews_rating ON product_reviews(product_id, rating);

COMMENT ON TABLE product_reviews IS 'Customer reviews for products';

-- Review helpful votes
CREATE TABLE IF NOT EXISTS review_helpful_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(review_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_review_helpful_votes_review ON review_helpful_votes(review_id);

-- ============================================================================
-- PRODUCT VIEWS (for recommendations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    view_count INTEGER DEFAULT 1,
    last_viewed_at TIMESTAMPTZ DEFAULT NOW(),
    session_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(customer_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_views_customer ON product_views(customer_id);
CREATE INDEX IF NOT EXISTS idx_product_views_product ON product_views(product_id);
CREATE INDEX IF NOT EXISTS idx_product_views_last_viewed ON product_views(last_viewed_at DESC);

COMMENT ON TABLE product_views IS 'Track product views for recommendations';

-- ============================================================================
-- INVOICES TABLE ENHANCEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    
    -- Invoice details
    invoice_number TEXT NOT NULL UNIQUE,
    invoice_type TEXT DEFAULT 'tax_invoice' CHECK (invoice_type IN ('tax_invoice', 'credit_note', 'debit_note', 'proforma')),
    invoice_date TIMESTAMPTZ NOT NULL,
    
    -- Amounts
    subtotal NUMERIC(12, 2) NOT NULL,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    cgst_amount NUMERIC(12, 2) DEFAULT 0,
    sgst_amount NUMERIC(12, 2) DEFAULT 0,
    igst_amount NUMERIC(12, 2) DEFAULT 0,
    shipping_amount NUMERIC(12, 2) DEFAULT 0,
    discount_amount NUMERIC(12, 2) DEFAULT 0,
    total_amount NUMERIC(12, 2) NOT NULL,
    
    -- GST details
    is_inter_state BOOLEAN DEFAULT false,
    customer_gstin TEXT,
    place_of_supply TEXT,
    
    -- Storage
    invoice_data JSONB,
    pdf_url TEXT,
    
    -- Status
    status TEXT DEFAULT 'generated' CHECK (status IN ('draft', 'generated', 'sent', 'paid', 'cancelled')),
    gst_filed BOOLEAN DEFAULT false,
    gst_filed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_vendor ON invoices(vendor_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
-- Note: Functional indexes on invoice_date would require IMMUTABLE functions
-- Using plain column index instead for filtering
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(vendor_id, created_at DESC);

COMMENT ON TABLE invoices IS 'GST-compliant tax invoices';

-- ============================================================================
-- PRODUCT ENHANCEMENTS
-- ============================================================================

-- Add missing columns to products table
DO $$ BEGIN
    -- Rating and reviews
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'rating') THEN
        ALTER TABLE products ADD COLUMN rating NUMERIC(2, 1) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'review_count') THEN
        ALTER TABLE products ADD COLUMN review_count INTEGER DEFAULT 0;
    END IF;
    
    -- View and sales tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'view_count') THEN
        ALTER TABLE products ADD COLUMN view_count INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'sales_count') THEN
        ALTER TABLE products ADD COLUMN sales_count INTEGER DEFAULT 0;
    END IF;
    
    -- Brand field
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'brand') THEN
        ALTER TABLE products ADD COLUMN brand TEXT;
    END IF;
    
    -- Material field
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'material') THEN
        ALTER TABLE products ADD COLUMN material TEXT;
    END IF;
    
    -- Specifications JSONB
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'specifications') THEN
        ALTER TABLE products ADD COLUMN specifications JSONB DEFAULT '{}'::jsonb;
    END IF;
    
    COMMENT ON COLUMN products.rating IS 'Average rating from product reviews';
    COMMENT ON COLUMN products.review_count IS 'Total number of product reviews';
    COMMENT ON COLUMN products.view_count IS 'Total product views';
    COMMENT ON COLUMN products.sales_count IS 'Total units sold';
    COMMENT ON COLUMN products.brand IS 'Product brand name';
    COMMENT ON COLUMN products.material IS 'Product material/composition';
    COMMENT ON COLUMN products.specifications IS 'Additional product specifications';
END $$;

-- ============================================================================
-- VENDOR LOGISTICS SETTINGS
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'fulfillment_type') THEN
        ALTER TABLE vendors ADD COLUMN fulfillment_type TEXT DEFAULT 'warmpawz' CHECK (fulfillment_type IN ('warmpawz', 'self', 'hybrid'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'default_carrier') THEN
        ALTER TABLE vendors ADD COLUMN default_carrier TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'return_address') THEN
        ALTER TABLE vendors ADD COLUMN return_address JSONB;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'shipping_origin_pincode') THEN
        ALTER TABLE vendors ADD COLUMN shipping_origin_pincode TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'processing_days') THEN
        ALTER TABLE vendors ADD COLUMN processing_days INTEGER DEFAULT 1;
    END IF;
END $$;

-- ============================================================================
-- SHIPMENTS ENHANCEMENT
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'fulfillment_type') THEN
        ALTER TABLE shipments ADD COLUMN fulfillment_type TEXT DEFAULT 'warmpawz';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'vendor_notes') THEN
        ALTER TABLE shipments ADD COLUMN vendor_notes TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'last_polled_at') THEN
        ALTER TABLE shipments ADD COLUMN last_polled_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'status_history') THEN
        ALTER TABLE shipments ADD COLUMN status_history JSONB DEFAULT '[]'::jsonb;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'delivery_photo') THEN
        ALTER TABLE shipments ADD COLUMN delivery_photo TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'recipient_name') THEN
        ALTER TABLE shipments ADD COLUMN recipient_name TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'delivery_notes') THEN
        ALTER TABLE shipments ADD COLUMN delivery_notes TEXT;
    END IF;
END $$;

-- ============================================================================
-- ORDER STATUS HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    notes TEXT,
    changed_by UUID,
    changed_by_type TEXT CHECK (changed_by_type IN ('system', 'vendor', 'admin', 'customer')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id);

COMMENT ON TABLE order_status_history IS 'Track order status changes for audit trail';

-- ============================================================================
-- ORDER ITEMS ENHANCEMENT
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'hsn_code') THEN
        ALTER TABLE order_items ADD COLUMN hsn_code TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'tax_amount') THEN
        ALTER TABLE order_items ADD COLUMN tax_amount NUMERIC(10, 2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'variant_info') THEN
        ALTER TABLE order_items ADD COLUMN variant_info JSONB;
    END IF;
END $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================

COMMENT ON TABLE product_reviews IS 'Customer reviews for products with ratings, photos, and verified purchase flag';
COMMENT ON TABLE product_views IS 'Track product views for building recommendation engine';
COMMENT ON TABLE invoices IS 'GST-compliant tax invoices with GSTR-1 export support';
COMMENT ON TABLE order_status_history IS 'Audit trail for order status changes';
