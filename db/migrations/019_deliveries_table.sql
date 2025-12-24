-- Migration: Create deliveries table for SQL-only hyperlocal delivery management
-- Replaces KV store usage for delivery:${deliveryId}

CREATE TABLE IF NOT EXISTS deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL, -- References order/booking ID
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    nutritionist_id UUID REFERENCES vendors(id),
    
    -- Items (JSONB array)
    items JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{ mealPlanId?, productId?, name, quantity, price }]
    
    -- Pickup Location
    pickup_address TEXT NOT NULL,
    pickup_lat NUMERIC(10, 8) NOT NULL,
    pickup_lng NUMERIC(11, 8) NOT NULL,
    pickup_contact_name TEXT NOT NULL,
    pickup_contact_phone TEXT NOT NULL,
    
    -- Dropoff Location
    dropoff_address TEXT NOT NULL,
    dropoff_lat NUMERIC(10, 8) NOT NULL,
    dropoff_lng NUMERIC(11, 8) NOT NULL,
    dropoff_contact_name TEXT NOT NULL,
    dropoff_contact_phone TEXT NOT NULL,
    
    -- Delivery Details
    distance_km NUMERIC(10, 2), -- Distance in kilometers
    estimated_duration_minutes INTEGER, -- Estimated duration in minutes
    delivery_fee NUMERIC(10, 2) DEFAULT 0,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'confirmed', 'preparing', 'ready_for_pickup', 
        'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled'
    )),
    
    -- Delivery Partner
    delivery_partner_id UUID REFERENCES staff(id),
    delivery_partner_name TEXT,
    delivery_partner_phone TEXT,
    
    -- GPS Tracking
    current_lat NUMERIC(10, 8),
    current_lng NUMERIC(11, 8),
    current_location_timestamp TIMESTAMPTZ,
    
    -- Timeline
    ordered_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    prepared_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    
    -- OTP
    pickup_otp TEXT,
    delivery_otp TEXT,
    
    -- Notes
    instructions TEXT,
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_customer_id ON deliveries(customer_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_vendor_id ON deliveries(vendor_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_delivery_partner_id ON deliveries(delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON deliveries(order_id);

COMMENT ON TABLE deliveries IS 'Hyperlocal delivery orders - replaces delivery:${deliveryId} KV keys';

