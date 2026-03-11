-- ============================================================================
-- MIGRATION 023: Ecommerce Policies Table
-- ============================================================================
-- Date: 2024-12-23
-- Purpose: Create tables for ecommerce policies (return, shipping, warranty, refund)
-- Migration: Phase 3, Task 3.2 - Complete Ecommerce Policies
-- ============================================================================

-- Ecommerce Policies
CREATE TABLE IF NOT EXISTS ecommerce_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    policy_type TEXT NOT NULL CHECK (policy_type IN ('return', 'shipping', 'warranty', 'refund', 'cancellation', 'exchange')),
    
    -- Policy Details
    policy_name TEXT NOT NULL,
    policy_description TEXT,
    policy_data JSONB NOT NULL, -- Detailed policy configuration
    
    -- Return Policy Specific
    return_window_days INTEGER, -- Days within which returns are accepted
    return_conditions TEXT[], -- Array of conditions (e.g., ['unopened', 'original_packaging'])
    return_shipping_cost NUMERIC(10, 2), -- Who pays return shipping
    refund_processing_days INTEGER, -- Days to process refund
    
    -- Shipping Policy Specific
    shipping_zones JSONB, -- {zone_name: {countries: [], states: [], rates: []}}
    shipping_rates JSONB, -- {standard: 50, express: 100, free_threshold: 1000}
    delivery_timeframes JSONB, -- {standard: '3-5 days', express: '1-2 days'}
    free_shipping_threshold NUMERIC(10, 2), -- Minimum order for free shipping
    
    -- Warranty Policy Specific
    warranty_period_days INTEGER,
    warranty_terms TEXT,
    warranty_claim_process TEXT,
    
    -- Refund Policy Specific
    refund_method TEXT CHECK (refund_method IN ('original_payment', 'store_credit', 'exchange')),
    refund_processing_time_days INTEGER,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false, -- Default policy for vendor
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ecommerce_policies_vendor_id ON ecommerce_policies(vendor_id);
CREATE INDEX IF NOT EXISTS idx_ecommerce_policies_type ON ecommerce_policies(policy_type);
CREATE INDEX IF NOT EXISTS idx_ecommerce_policies_active ON ecommerce_policies(is_active) WHERE is_active = true;

-- Product Policy Mapping (Link products to specific policies)
CREATE TABLE IF NOT EXISTS product_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    policy_id UUID NOT NULL REFERENCES ecommerce_policies(id) ON DELETE CASCADE,
    policy_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(product_id, policy_id, policy_type)
);

CREATE INDEX IF NOT EXISTS idx_product_policies_product_id ON product_policies(product_id);
CREATE INDEX IF NOT EXISTS idx_product_policies_policy_id ON product_policies(policy_id);

-- Policy Acceptance Tracking
CREATE TABLE IF NOT EXISTS policy_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    policy_id UUID NOT NULL REFERENCES ecommerce_policies(id) ON DELETE CASCADE,
    policy_type TEXT NOT NULL,
    accepted_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_policy_acceptances_customer_id ON policy_acceptances(customer_id);
CREATE INDEX IF NOT EXISTS idx_policy_acceptances_order_id ON policy_acceptances(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_policy_acceptances_policy_id ON policy_acceptances(policy_id);

COMMENT ON TABLE ecommerce_policies IS 'Ecommerce policies for vendors - return, shipping, warranty, refund';
COMMENT ON TABLE product_policies IS 'Link products to specific policies';
COMMENT ON TABLE policy_acceptances IS 'Track customer acceptance of policies';

