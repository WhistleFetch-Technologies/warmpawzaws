-- ============================================================================
-- MIGRATION 200: Complete Pharmacy & Meal Delivery System
-- ============================================================================
-- Date: 2026-01-19
-- Purpose: Complete schema for Pharmacy Uber Model + Nutritionist Meal Delivery
-- Features:
--   1. Pharmacy order broadcasting (Uber-style radius expansion)
--   2. Logistics management (own vs Warmpawz)
--   3. Meal plans & subscriptions
--   4. Order tracking & delivery
--   5. Settlement with logistics deductions
-- ============================================================================

-- ============================================================================
-- PART 1: HYPERLOCAL LOGISTICS RULES (Enhance existing table)
-- ============================================================================

-- Add new columns to existing logistics_rules table if they don't exist
DO $$
BEGIN
  -- Add min_distance_km
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'logistics_rules' AND column_name = 'min_distance_km') THEN
    ALTER TABLE logistics_rules ADD COLUMN min_distance_km NUMERIC(5,2) DEFAULT 0;
    RAISE NOTICE 'Added min_distance_km column';
  END IF;
  
  -- Add max_distance_km
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'logistics_rules' AND column_name = 'max_distance_km') THEN
    ALTER TABLE logistics_rules ADD COLUMN max_distance_km NUMERIC(5,2);
    RAISE NOTICE 'Added max_distance_km column';
  END IF;
  
  -- Add base_fee
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'logistics_rules' AND column_name = 'base_fee') THEN
    ALTER TABLE logistics_rules ADD COLUMN base_fee NUMERIC(10,2) DEFAULT 0;
    RAISE NOTICE 'Added base_fee column';
  END IF;
  
  -- Add per_km_rate
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'logistics_rules' AND column_name = 'per_km_rate') THEN
    ALTER TABLE logistics_rules ADD COLUMN per_km_rate NUMERIC(10,2) DEFAULT 0;
    RAISE NOTICE 'Added per_km_rate column';
  END IF;
  
  -- Add applies_to
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'logistics_rules' AND column_name = 'applies_to') THEN
    ALTER TABLE logistics_rules ADD COLUMN applies_to VARCHAR(50)[] DEFAULT ARRAY['pharmacy', 'meal_delivery'];
    RAISE NOTICE 'Added applies_to column';
  END IF;
  
  -- Add city
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'logistics_rules' AND column_name = 'city') THEN
    ALTER TABLE logistics_rules ADD COLUMN city VARCHAR(100);
    RAISE NOTICE 'Added city column';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error adding columns to logistics_rules: %', SQLERRM;
END $$;

COMMENT ON TABLE logistics_rules IS 'Hyperlocal logistics pricing rules - per km or flat rate by distance slab';

-- Insert default logistics rules using JSONB format for existing table compatibility
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM logistics_rules WHERE rule_name = '0-5km Standard' LIMIT 1) THEN
    INSERT INTO logistics_rules (rule_name, rule_type, rule_config, min_distance_km, max_distance_km, base_fee, per_km_rate, applies_to) VALUES
    ('0-5km Standard', 'slab', '{"min_km": 0, "max_km": 5, "base_fee": 30}'::jsonb, 0, 5, 30.00, 0, ARRAY['pharmacy', 'meal_delivery']),
    ('5-10km Standard', 'slab', '{"min_km": 5, "max_km": 10, "base_fee": 50}'::jsonb, 5, 10, 50.00, 0, ARRAY['pharmacy', 'meal_delivery']),
    ('10-20km Standard', 'slab', '{"min_km": 10, "max_km": 20, "base_fee": 80}'::jsonb, 10, 20, 80.00, 0, ARRAY['pharmacy', 'meal_delivery']),
    ('Per KM Rate', 'per_km', '{"base_fee": 20, "per_km_rate": 8}'::jsonb, 0, NULL, 20.00, 8.00, ARRAY['pharmacy', 'meal_delivery'])
    ON CONFLICT (rule_name) DO NOTHING;
    RAISE NOTICE 'Inserted default logistics rules';
  ELSE
    RAISE NOTICE 'Default logistics rules already exist';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not insert logistics rules: %', SQLERRM;
END $$;

-- ============================================================================
-- PART 2: PHARMACY ORDERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS pharmacy_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(20) UNIQUE NOT NULL,
    -- References
    customer_id UUID NOT NULL REFERENCES customers(id),
    prescription_id UUID REFERENCES prescriptions(id),
    pharmacy_id UUID REFERENCES vendors(id), -- Assigned pharmacy
    -- Order details
    items JSONB NOT NULL DEFAULT '[]', -- [{medicine_name, quantity, unit_price, total}]
    subtotal NUMERIC(10,2) NOT NULL,
    delivery_fee NUMERIC(10,2) DEFAULT 0,
    platform_fee NUMERIC(10,2) DEFAULT 0,
    total_amount NUMERIC(10,2) NOT NULL,
    -- Location
    delivery_address JSONB NOT NULL, -- {address, lat, lng, landmark, pincode}
    customer_lat NUMERIC(10,7),
    customer_lng NUMERIC(10,7),
    -- Payment
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('online', 'cod')),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    -- Logistics
    logistics_type VARCHAR(20) DEFAULT 'warmpawz' CHECK (logistics_type IN ('own', 'warmpawz')),
    logistics_partner_id UUID REFERENCES vendors(id), -- If warmpawz logistics
    logistics_cost NUMERIC(10,2) DEFAULT 0,
    -- Status
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN (
        'pending', 'broadcasting', 'accepted', 'preparing', 
        'ready_for_pickup', 'picked_up', 'on_the_way', 
        'delivered', 'cancelled', 'rejected'
    )),
    -- Broadcasting
    current_broadcast_radius_km INTEGER DEFAULT 5,
    broadcast_started_at TIMESTAMPTZ,
    broadcast_expires_at TIMESTAMPTZ,
    -- Timestamps
    accepted_at TIMESTAMPTZ,
    prepared_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    -- ETA
    estimated_delivery_time TIMESTAMPTZ,
    actual_delivery_time TIMESTAMPTZ,
    -- Settlement
    settlement_status VARCHAR(20) DEFAULT 'pending' CHECK (settlement_status IN ('pending', 'processing', 'completed')),
    vendor_payout NUMERIC(10,2),
    commission_amount NUMERIC(10,2),
    logistics_deduction NUMERIC(10,2),
    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_customer ON pharmacy_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_pharmacy ON pharmacy_orders(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_status ON pharmacy_orders(status);
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_broadcasting ON pharmacy_orders(status, broadcast_expires_at) 
    WHERE status = 'broadcasting';

-- Pharmacy broadcast tracking (which pharmacies were pinged)
CREATE TABLE IF NOT EXISTS pharmacy_broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES pharmacy_orders(id) ON DELETE CASCADE,
    pharmacy_id UUID NOT NULL REFERENCES vendors(id),
    radius_km INTEGER NOT NULL, -- 5, 10, or 20
    distance_from_customer NUMERIC(5,2),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'accepted', 'rejected', 'expired')),
    broadcast_time TIMESTAMPTZ DEFAULT NOW(),
    response_time TIMESTAMPTZ,
    rejection_reason TEXT,
    quoted_delivery_fee NUMERIC(10,2),
    quoted_eta_minutes INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(order_id, pharmacy_id)
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_broadcasts_pending ON pharmacy_broadcasts(pharmacy_id, status) 
    WHERE status = 'pending';

-- ============================================================================
-- PART 3: MEAL PLANS & NUTRITIONIST (Enhance existing table)
-- ============================================================================

-- Add new columns to existing meal_plans table if they don't exist
DO $$
BEGIN
  -- Add name (some versions have plan_name)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meal_plans' AND column_name = 'name') THEN
    ALTER TABLE meal_plans ADD COLUMN name VARCHAR(200);
    -- Copy from plan_name if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meal_plans' AND column_name = 'plan_name') THEN
      UPDATE meal_plans SET name = plan_name WHERE name IS NULL;
    END IF;
    RAISE NOTICE 'Added name column to meal_plans';
  END IF;
  
  -- Add short_description
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meal_plans' AND column_name = 'short_description') THEN
    ALTER TABLE meal_plans ADD COLUMN short_description VARCHAR(500);
  END IF;
  
  -- Add photos
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meal_plans' AND column_name = 'photos') THEN
    ALTER TABLE meal_plans ADD COLUMN photos JSONB DEFAULT '[]';
  END IF;
  
  -- Add thumbnail_url
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meal_plans' AND column_name = 'thumbnail_url') THEN
    ALTER TABLE meal_plans ADD COLUMN thumbnail_url TEXT;
  END IF;
  
  -- Add meal_type
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meal_plans' AND column_name = 'meal_type') THEN
    ALTER TABLE meal_plans ADD COLUMN meal_type VARCHAR(50) DEFAULT 'fresh_daily';
  END IF;
  
  -- Add diet_type
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meal_plans' AND column_name = 'diet_type') THEN
    ALTER TABLE meal_plans ADD COLUMN diet_type VARCHAR(50)[] DEFAULT '{}';
  END IF;
  
  -- Add suitable_for
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meal_plans' AND column_name = 'suitable_for') THEN
    ALTER TABLE meal_plans ADD COLUMN suitable_for JSONB DEFAULT '{}';
  END IF;
  
  -- Add ingredients
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meal_plans' AND column_name = 'ingredients') THEN
    ALTER TABLE meal_plans ADD COLUMN ingredients JSONB DEFAULT '[]';
  END IF;
  
  -- Add nutrition_info
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meal_plans' AND column_name = 'nutrition_info') THEN
    ALTER TABLE meal_plans ADD COLUMN nutrition_info JSONB DEFAULT '{}';
  END IF;
  
  -- Add allergens
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meal_plans' AND column_name = 'allergens') THEN
    ALTER TABLE meal_plans ADD COLUMN allergens VARCHAR(100)[] DEFAULT '{}';
  END IF;
  
  -- Add price_per_meal
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meal_plans' AND column_name = 'price_per_meal') THEN
    ALTER TABLE meal_plans ADD COLUMN price_per_meal NUMERIC(10,2);
    -- Copy from price if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meal_plans' AND column_name = 'price') THEN
      UPDATE meal_plans SET price_per_meal = price WHERE price_per_meal IS NULL;
    END IF;
  END IF;
  
  -- Add price_per_week
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meal_plans' AND column_name = 'price_per_week') THEN
    ALTER TABLE meal_plans ADD COLUMN price_per_week NUMERIC(10,2);
  END IF;
  
  -- Add price_per_month
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meal_plans' AND column_name = 'price_per_month') THEN
    ALTER TABLE meal_plans ADD COLUMN price_per_month NUMERIC(10,2);
  END IF;
  
  -- Add prep_time_minutes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meal_plans' AND column_name = 'prep_time_minutes') THEN
    ALTER TABLE meal_plans ADD COLUMN prep_time_minutes INTEGER DEFAULT 60;
  END IF;
  
  -- Add shelf_life_days
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meal_plans' AND column_name = 'shelf_life_days') THEN
    ALTER TABLE meal_plans ADD COLUMN shelf_life_days INTEGER DEFAULT 1;
  END IF;
  
  -- Add storage_instructions
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meal_plans' AND column_name = 'storage_instructions') THEN
    ALTER TABLE meal_plans ADD COLUMN storage_instructions TEXT;
  END IF;
  
  -- Add serving_instructions
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meal_plans' AND column_name = 'serving_instructions') THEN
    ALTER TABLE meal_plans ADD COLUMN serving_instructions TEXT;
  END IF;
  
  -- Add available_days
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meal_plans' AND column_name = 'available_days') THEN
    ALTER TABLE meal_plans ADD COLUMN available_days VARCHAR(10)[] DEFAULT ARRAY['mon','tue','wed','thu','fri','sat','sun'];
  END IF;
  
  -- Add order_cutoff_time
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meal_plans' AND column_name = 'order_cutoff_time') THEN
    ALTER TABLE meal_plans ADD COLUMN order_cutoff_time TIME DEFAULT '18:00';
  END IF;
  
  -- Add delivery_slots
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meal_plans' AND column_name = 'delivery_slots') THEN
    ALTER TABLE meal_plans ADD COLUMN delivery_slots JSONB DEFAULT '[]';
  END IF;
  
  -- Add lead_time_hours
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meal_plans' AND column_name = 'lead_time_hours') THEN
    ALTER TABLE meal_plans ADD COLUMN lead_time_hours INTEGER DEFAULT 24;
  END IF;
  
  -- Add is_featured
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meal_plans' AND column_name = 'is_featured') THEN
    ALTER TABLE meal_plans ADD COLUMN is_featured BOOLEAN DEFAULT false;
  END IF;
  
  -- Add total_orders
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meal_plans' AND column_name = 'total_orders') THEN
    ALTER TABLE meal_plans ADD COLUMN total_orders INTEGER DEFAULT 0;
  END IF;
  
  -- Add avg_rating
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meal_plans' AND column_name = 'avg_rating') THEN
    ALTER TABLE meal_plans ADD COLUMN avg_rating NUMERIC(2,1) DEFAULT 0;
  END IF;
  
  -- Add total_reviews
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meal_plans' AND column_name = 'total_reviews') THEN
    ALTER TABLE meal_plans ADD COLUMN total_reviews INTEGER DEFAULT 0;
  END IF;
  
  RAISE NOTICE 'meal_plans table enhanced with new columns';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error enhancing meal_plans: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_meal_plans_vendor ON meal_plans(vendor_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_active ON meal_plans(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_meal_plans_type ON meal_plans(meal_type) WHERE meal_type IS NOT NULL;

-- Meal subscriptions
CREATE TABLE IF NOT EXISTS meal_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    meal_plan_id UUID NOT NULL REFERENCES meal_plans(id),
    pet_id UUID REFERENCES pets(id),
    -- Subscription details
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('once_daily', 'twice_daily', 'alternate_days', 'weekly')),
    meals_per_delivery INTEGER DEFAULT 1,
    delivery_days VARCHAR(10)[] DEFAULT ARRAY['mon','tue','wed','thu','fri','sat','sun'],
    preferred_delivery_slot JSONB, -- {start: '09:00', end: '12:00'}
    -- Delivery address
    delivery_address JSONB NOT NULL,
    customer_lat NUMERIC(10,7),
    customer_lng NUMERIC(10,7),
    -- Pricing
    price_per_delivery NUMERIC(10,2) NOT NULL,
    delivery_fee_per_delivery NUMERIC(10,2) DEFAULT 0,
    -- Billing
    billing_cycle VARCHAR(20) DEFAULT 'weekly' CHECK (billing_cycle IN ('weekly', 'monthly')),
    next_billing_date DATE,
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),
    pause_until DATE,
    -- Payment
    payment_method VARCHAR(20) DEFAULT 'online', -- Only online for meals
    razorpay_subscription_id VARCHAR(100),
    -- Dates
    start_date DATE NOT NULL,
    end_date DATE,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meal_subscriptions_customer ON meal_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_meal_subscriptions_vendor ON meal_subscriptions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_meal_subscriptions_active ON meal_subscriptions(status) WHERE status = 'active';

-- Meal orders (both adhoc and subscription-generated)
CREATE TABLE IF NOT EXISTS meal_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(20) UNIQUE NOT NULL,
    -- References
    customer_id UUID NOT NULL REFERENCES customers(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    meal_plan_id UUID NOT NULL REFERENCES meal_plans(id),
    subscription_id UUID REFERENCES meal_subscriptions(id), -- NULL for adhoc
    pet_id UUID REFERENCES pets(id),
    -- Order type
    order_type VARCHAR(20) DEFAULT 'adhoc' CHECK (order_type IN ('adhoc', 'subscription')),
    -- Items
    quantity INTEGER DEFAULT 1,
    special_instructions TEXT,
    -- Pricing
    subtotal NUMERIC(10,2) NOT NULL,
    delivery_fee NUMERIC(10,2) DEFAULT 0,
    platform_fee NUMERIC(10,2) DEFAULT 0,
    total_amount NUMERIC(10,2) NOT NULL,
    -- Delivery
    delivery_address JSONB NOT NULL,
    customer_lat NUMERIC(10,7),
    customer_lng NUMERIC(10,7),
    scheduled_delivery_date DATE NOT NULL,
    scheduled_delivery_slot JSONB, -- {start: '09:00', end: '12:00'}
    -- Payment (online only for meals)
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    -- Logistics
    logistics_type VARCHAR(20) DEFAULT 'warmpawz' CHECK (logistics_type IN ('own', 'warmpawz')),
    logistics_partner_id UUID REFERENCES vendors(id),
    logistics_cost NUMERIC(10,2) DEFAULT 0,
    -- Status
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN (
        'pending', 'confirmed', 'preparing', 'ready_for_pickup',
        'picked_up', 'on_the_way', 'delivered', 'cancelled'
    )),
    -- Timestamps
    confirmed_at TIMESTAMPTZ,
    prep_started_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    -- ETA
    estimated_delivery_time TIMESTAMPTZ,
    actual_delivery_time TIMESTAMPTZ,
    -- Settlement
    settlement_status VARCHAR(20) DEFAULT 'pending' CHECK (settlement_status IN ('pending', 'processing', 'completed')),
    vendor_payout NUMERIC(10,2),
    commission_amount NUMERIC(10,2),
    logistics_deduction NUMERIC(10,2),
    -- Rating
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    review TEXT,
    rated_at TIMESTAMPTZ,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meal_orders_customer ON meal_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_meal_orders_vendor ON meal_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_meal_orders_subscription ON meal_orders(subscription_id);
CREATE INDEX IF NOT EXISTS idx_meal_orders_status ON meal_orders(status);
CREATE INDEX IF NOT EXISTS idx_meal_orders_delivery_date ON meal_orders(scheduled_delivery_date);

-- ============================================================================
-- PART 4: DELIVERY TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS delivery_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Can reference pharmacy_order or meal_order
    pharmacy_order_id UUID REFERENCES pharmacy_orders(id),
    meal_order_id UUID REFERENCES meal_orders(id),
    -- Partner
    logistics_partner_id UUID REFERENCES vendors(id),
    delivery_person_name VARCHAR(200),
    delivery_person_phone VARCHAR(20),
    delivery_person_photo TEXT,
    vehicle_number VARCHAR(20),
    -- Live tracking
    current_lat NUMERIC(10,7),
    current_lng NUMERIC(10,7),
    last_location_update TIMESTAMPTZ,
    -- Status
    status VARCHAR(30) DEFAULT 'assigned' CHECK (status IN (
        'assigned', 'heading_to_pickup', 'at_pickup', 
        'picked_up', 'on_the_way', 'nearby', 'delivered', 'failed'
    )),
    -- ETAs
    eta_to_pickup_minutes INTEGER,
    eta_to_delivery_minutes INTEGER,
    distance_remaining_km NUMERIC(5,2),
    -- Timestamps
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    reached_pickup_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    -- Proof of delivery
    delivery_photo TEXT,
    recipient_name VARCHAR(200),
    delivery_notes TEXT,
    -- OTP verification
    delivery_otp VARCHAR(6),
    otp_verified BOOLEAN DEFAULT false,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Ensure only one reference
    CONSTRAINT delivery_tracking_order_check CHECK (
        (pharmacy_order_id IS NOT NULL AND meal_order_id IS NULL) OR
        (pharmacy_order_id IS NULL AND meal_order_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_delivery_tracking_pharmacy ON delivery_tracking(pharmacy_order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_meal ON delivery_tracking(meal_order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_partner ON delivery_tracking(logistics_partner_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_active ON delivery_tracking(status) 
    WHERE status NOT IN ('delivered', 'failed');

-- Location history for tracking path
CREATE TABLE IF NOT EXISTS delivery_location_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_id UUID NOT NULL REFERENCES delivery_tracking(id) ON DELETE CASCADE,
    lat NUMERIC(10,7) NOT NULL,
    lng NUMERIC(10,7) NOT NULL,
    accuracy_meters NUMERIC(6,2),
    speed_kmh NUMERIC(5,2),
    heading INTEGER, -- 0-360 degrees
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_history_tracking ON delivery_location_history(tracking_id, recorded_at DESC);

-- ============================================================================
-- PART 5: VENDOR BANK ACCOUNTS (for Razorpay Marketplace)
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    -- Bank details
    account_holder_name VARCHAR(200) NOT NULL,
    account_number VARCHAR(30) NOT NULL,
    ifsc_code VARCHAR(11) NOT NULL,
    bank_name VARCHAR(200),
    branch_name VARCHAR(200),
    account_type VARCHAR(20) DEFAULT 'savings' CHECK (account_type IN ('savings', 'current')),
    -- Razorpay linked account
    razorpay_account_id VARCHAR(100),
    razorpay_fund_account_id VARCHAR(100),
    -- Verification
    is_verified BOOLEAN DEFAULT false,
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN (
        'pending', 'submitted', 'verified', 'failed'
    )),
    verification_error TEXT,
    verified_at TIMESTAMPTZ,
    -- Primary account
    is_primary BOOLEAN DEFAULT true,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_bank_accounts_vendor ON vendor_bank_accounts(vendor_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_bank_accounts_primary ON vendor_bank_accounts(vendor_id) 
    WHERE is_primary = true;

-- ============================================================================
-- PART 6: SETTLEMENT TRACKING (Enhanced)
-- ============================================================================

CREATE TABLE IF NOT EXISTS delivery_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_batch_id VARCHAR(50),
    -- Order reference (one of these)
    pharmacy_order_id UUID REFERENCES pharmacy_orders(id),
    meal_order_id UUID REFERENCES meal_orders(id),
    -- Vendor
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    -- Amounts
    order_amount NUMERIC(10,2) NOT NULL,
    delivery_fee_collected NUMERIC(10,2) DEFAULT 0,
    platform_fee NUMERIC(10,2) DEFAULT 0,
    commission_rate NUMERIC(5,2), -- From vendor tier
    commission_amount NUMERIC(10,2),
    logistics_cost NUMERIC(10,2) DEFAULT 0, -- Deducted if Warmpawz logistics
    gst_amount NUMERIC(10,2) DEFAULT 0,
    tds_amount NUMERIC(10,2) DEFAULT 0,
    net_payout NUMERIC(10,2) NOT NULL,
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'transferred', 'failed'
    )),
    -- Razorpay
    razorpay_transfer_id VARCHAR(100),
    razorpay_payout_id VARCHAR(100),
    transfer_error TEXT,
    -- Dates
    order_delivered_at TIMESTAMPTZ,
    scheduled_payout_date DATE,
    actual_payout_date DATE,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_settlements_vendor ON delivery_settlements(vendor_id);
CREATE INDEX IF NOT EXISTS idx_delivery_settlements_status ON delivery_settlements(status);
CREATE INDEX IF NOT EXISTS idx_delivery_settlements_batch ON delivery_settlements(settlement_batch_id);

-- ============================================================================
-- PART 7: TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all new tables
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN 
        SELECT unnest(ARRAY[
            'logistics_rules', 'pharmacy_orders', 'pharmacy_broadcasts',
            'meal_plans', 'meal_subscriptions', 'meal_orders',
            'delivery_tracking', 'vendor_bank_accounts', 'delivery_settlements'
        ])
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trigger_update_%s_updated_at ON %s;
            CREATE TRIGGER trigger_update_%s_updated_at
                BEFORE UPDATE ON %s
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        ', tbl, tbl, tbl, tbl);
    END LOOP;
END $$;

-- ============================================================================
-- PART 8: GENERATE ORDER NUMBERS
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_order_number(prefix TEXT)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    result := prefix || TO_CHAR(NOW(), 'YYMMDD') || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-generate order numbers
CREATE OR REPLACE FUNCTION set_pharmacy_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL THEN
        NEW.order_number := generate_order_number('PH');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_pharmacy_order_number
    BEFORE INSERT ON pharmacy_orders
    FOR EACH ROW
    EXECUTE FUNCTION set_pharmacy_order_number();

CREATE OR REPLACE FUNCTION set_meal_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL THEN
        NEW.order_number := generate_order_number('ML');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_meal_order_number
    BEFORE INSERT ON meal_orders
    FOR EACH ROW
    EXECUTE FUNCTION set_meal_order_number();

CREATE OR REPLACE FUNCTION set_subscription_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.subscription_number IS NULL THEN
        NEW.subscription_number := generate_order_number('SUB');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_subscription_number
    BEFORE INSERT ON meal_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION set_subscription_number();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 200 completed successfully!';
    RAISE NOTICE 'Tables created: logistics_rules, pharmacy_orders, pharmacy_broadcasts, meal_plans, meal_subscriptions, meal_orders, delivery_tracking, delivery_location_history, vendor_bank_accounts, delivery_settlements';
END $$;
