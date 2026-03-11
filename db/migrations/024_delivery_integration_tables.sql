-- ============================================================================
-- DELIVERY INTEGRATION TABLES
-- ============================================================================
-- 
-- Tables for delivery partner management, deliveries, and route optimization.
-- Note: shipments table already exists in 004_kv_to_sql_complete.sql
-- This extends it with delivery partner management and route optimization.
-- 
-- Migration: Phase 6 - Complete KV to SQL Migration
-- Date: 2025-01-27
-- ============================================================================

-- ============================================================================
-- DELIVERY PARTNERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS delivery_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id TEXT NOT NULL UNIQUE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('bike', 'scooter', 'car', 'van')),
    vehicle_number TEXT NOT NULL,
    
    -- Current Location (JSONB)
    current_location JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN (
        'available',
        'on_delivery',
        'offline'
    )),
    
    rating NUMERIC(3, 1) DEFAULT 5.0 CHECK (rating >= 0 AND rating <= 5),
    total_deliveries INTEGER DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_delivery_partners_partner_id ON delivery_partners(partner_id);
CREATE INDEX idx_delivery_partners_vendor_id ON delivery_partners(vendor_id);
CREATE INDEX idx_delivery_partners_status ON delivery_partners(status) WHERE status = 'available' AND is_active = true;

COMMENT ON TABLE delivery_partners IS 'Delivery partners - maps from delivery:partner:{partnerId} KV keys';

-- ============================================================================
-- DELIVERIES
-- ============================================================================
-- Note: shipments table exists but this is for nutritionist meal/supplement delivery
-- which may have different requirements

CREATE TABLE IF NOT EXISTS deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id TEXT NOT NULL UNIQUE,
    order_id TEXT NOT NULL,
    order_type TEXT NOT NULL CHECK (order_type IN ('meal_plan', 'supplement', 'product')),
    
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    
    -- Pickup Location (JSONB)
    pickup_location JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Drop Location (JSONB)
    drop_location JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    partner_id TEXT REFERENCES delivery_partners(partner_id) ON DELETE SET NULL,
    partner_name TEXT,
    partner_phone TEXT,
    
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'assigned',
        'picked_up',
        'in_transit',
        'delivered',
        'failed',
        'cancelled'
    )),
    
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    assigned_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    
    estimated_distance NUMERIC(10, 2), -- in km
    estimated_time INTEGER, -- in minutes
    actual_distance NUMERIC(10, 2), -- in km
    actual_time INTEGER, -- in minutes
    
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
    
    -- Route tracking (JSONB array)
    route JSONB DEFAULT '[]'::jsonb,
    
    -- Proof of Delivery (JSONB)
    proof_of_delivery JSONB,
    
    failure_reason TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_deliveries_delivery_id ON deliveries(delivery_id);
CREATE INDEX idx_deliveries_order_id ON deliveries(order_id);
CREATE INDEX idx_deliveries_customer_id ON deliveries(customer_id);
CREATE INDEX idx_deliveries_partner_id ON deliveries(partner_id);
CREATE INDEX idx_deliveries_status ON deliveries(status);
CREATE INDEX idx_deliveries_scheduled_date ON deliveries(scheduled_date);

COMMENT ON TABLE deliveries IS 'Deliveries - maps from delivery:{deliveryId} KV keys';

-- ============================================================================
-- DELIVERY ROUTES
-- ============================================================================

CREATE TABLE IF NOT EXISTS delivery_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id TEXT NOT NULL UNIQUE,
    partner_id TEXT REFERENCES delivery_partners(partner_id) ON DELETE SET NULL,
    
    -- Delivery IDs array (JSONB)
    deliveries JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Optimized Order (JSONB array)
    optimized_order JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    total_distance NUMERIC(10, 2) DEFAULT 0, -- in km
    total_time INTEGER DEFAULT 0, -- in minutes
    
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN (
        'planned',
        'in_progress',
        'completed'
    )),
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_delivery_routes_route_id ON delivery_routes(route_id);
CREATE INDEX idx_delivery_routes_partner_id ON delivery_routes(partner_id);
CREATE INDEX idx_delivery_routes_status ON delivery_routes(status);

COMMENT ON TABLE delivery_routes IS 'Delivery routes - maps from delivery:route:{routeId} KV keys';

