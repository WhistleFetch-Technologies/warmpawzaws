-- ============================================================================
-- GAP ANALYSIS FIXES - DATABASE MIGRATIONS
-- ============================================================================
-- 
-- This migration addresses all database-related gaps identified in the 
-- comprehensive gap analysis report.
--
-- Fixes:
-- - DB-1: staff_availability_per_style table
-- - DB-2: gps_tracking_sessions table
-- - DB-3: meal_subscriptions table
-- - DB-4: customer_active_subscriptions table
-- - DB-5: notification_schedules table (scheduled_notifications)
-- - Additional supporting tables and columns
--
-- Date: 2026-01-21
-- ============================================================================

-- ============================================================================
-- DB-1: Staff Availability Per Service Style
-- Fixes GAP: CS-1, CS-5 - Staff can set availability per service style
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff_availability_per_style (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    service_style VARCHAR(20) NOT NULL CHECK (service_style IN ('at_home', 'at_center', 'tele')),
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT true,
    max_appointments_per_slot INTEGER DEFAULT 1,
    slot_duration_minutes INTEGER DEFAULT 30,
    buffer_minutes INTEGER DEFAULT 15,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_staff_style_day UNIQUE (staff_id, service_style, day_of_week)
);

CREATE INDEX idx_staff_availability_style_staff ON staff_availability_per_style(staff_id);
CREATE INDEX idx_staff_availability_style_style ON staff_availability_per_style(service_style);
CREATE INDEX idx_staff_availability_style_active ON staff_availability_per_style(is_active);

-- ============================================================================
-- DB-2: GPS Tracking Sessions
-- Fixes GAP: HS-1, HS-2, HS-3, PH-5 - Real-time GPS tracking for home services
-- ============================================================================

CREATE TABLE IF NOT EXISTS gps_tracking_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    staff_id UUID REFERENCES staff(id),
    customer_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'started', 'in_transit', 'arrived', 'completed', 'cancelled')),
    
    -- Start location
    start_latitude DECIMAL(10, 8),
    start_longitude DECIMAL(11, 8),
    
    -- Current location (updated in real-time)
    current_latitude DECIMAL(10, 8),
    current_longitude DECIMAL(11, 8),
    current_accuracy DECIMAL(6, 2),
    current_heading DECIMAL(5, 2),
    current_speed DECIMAL(6, 2),
    
    -- Destination
    destination_latitude DECIMAL(10, 8) NOT NULL,
    destination_longitude DECIMAL(11, 8) NOT NULL,
    destination_address TEXT,
    
    -- ETA and distance
    estimated_eta_minutes INTEGER,
    distance_km DECIMAL(8, 2),
    distance_remaining_km DECIMAL(8, 2),
    route_polyline TEXT,
    
    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE,
    arrived_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    last_update_at TIMESTAMP WITH TIME ZONE,
    
    cancellation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_gps_tracking_booking ON gps_tracking_sessions(booking_id);
CREATE INDEX idx_gps_tracking_vendor ON gps_tracking_sessions(vendor_id);
CREATE INDEX idx_gps_tracking_status ON gps_tracking_sessions(status);
CREATE INDEX idx_gps_tracking_active ON gps_tracking_sessions(status) 
    WHERE status IN ('started', 'in_transit');

-- GPS Location History for route replay
CREATE TABLE IF NOT EXISTS gps_location_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES gps_tracking_sessions(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(6, 2),
    heading DECIMAL(5, 2),
    speed DECIMAL(6, 2),
    eta_minutes INTEGER,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_gps_history_session ON gps_location_history(session_id);
CREATE INDEX idx_gps_history_time ON gps_location_history(recorded_at);

-- ============================================================================
-- DB-3: Meal Subscriptions
-- Fixes GAP: NU-1 - Daily/weekly meal subscription support
-- ============================================================================

CREATE TABLE IF NOT EXISTS meal_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    pet_id UUID NOT NULL REFERENCES pets(id),
    
    -- Subscription details
    subscription_type VARCHAR(20) NOT NULL 
        CHECK (subscription_type IN ('daily', 'weekly', 'monthly')),
    meal_plan_id UUID, -- Reference to meal plan
    meal_type VARCHAR(50), -- fresh, frozen, kibble, etc.
    purpose VARCHAR(100), -- weight_management, maintenance, puppy_growth, etc.
    
    -- Quantity and pricing
    meals_per_day INTEGER DEFAULT 1,
    quantity_per_meal DECIMAL(6, 2), -- in grams/ml
    price_per_delivery DECIMAL(10, 2) NOT NULL,
    delivery_fee DECIMAL(8, 2) DEFAULT 0,
    
    -- Schedule
    delivery_time_preference VARCHAR(20), -- morning, afternoon, evening
    delivery_days JSONB, -- ['monday', 'wednesday', 'friday'] for weekly
    start_date DATE NOT NULL,
    end_date DATE,
    next_delivery_date DATE,
    
    -- Delivery address
    delivery_address_id UUID,
    delivery_instructions TEXT,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active' 
        CHECK (status IN ('active', 'paused', 'cancelled', 'completed')),
    pause_start_date DATE,
    pause_end_date DATE,
    cancellation_reason TEXT,
    
    -- Payment
    payment_method_id VARCHAR(100),
    auto_renew BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_meal_sub_customer ON meal_subscriptions(customer_id);
CREATE INDEX idx_meal_sub_vendor ON meal_subscriptions(vendor_id);
CREATE INDEX idx_meal_sub_status ON meal_subscriptions(status);
CREATE INDEX idx_meal_sub_next_delivery ON meal_subscriptions(next_delivery_date);

-- Meal subscription deliveries
CREATE TABLE IF NOT EXISTS meal_subscription_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES meal_subscriptions(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    scheduled_time TIME,
    
    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled' 
        CHECK (status IN ('scheduled', 'preparing', 'ready', 'dispatched', 'delivered', 'failed', 'cancelled')),
    
    -- Logistics
    logistics_partner_id UUID,
    delivery_otp VARCHAR(6),
    
    -- Timestamps
    prepared_at TIMESTAMP WITH TIME ZONE,
    dispatched_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    
    -- Tracking
    tracking_url TEXT,
    delivery_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_meal_delivery_sub ON meal_subscription_deliveries(subscription_id);
CREATE INDEX idx_meal_delivery_date ON meal_subscription_deliveries(scheduled_date);
CREATE INDEX idx_meal_delivery_status ON meal_subscription_deliveries(status);

-- ============================================================================
-- DB-4: Customer Active Subscriptions (Unlimited plans)
-- Fixes GAP: PM-1 - Zero-payment booking for unlimited subscriptions
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    subscription_plan_id UUID NOT NULL,
    
    -- Plan details (denormalized for quick lookup)
    plan_name VARCHAR(200) NOT NULL,
    plan_type VARCHAR(50) NOT NULL CHECK (plan_type IN ('unlimited', 'credits', 'discount', 'membership')),
    service_category VARCHAR(100), -- vet, grooming, training, etc.
    vendor_id UUID, -- NULL for platform-wide, vendor_id for specific vendor
    
    -- Validity
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Usage tracking
    bookings_used INTEGER DEFAULT 0,
    bookings_limit INTEGER, -- NULL for truly unlimited
    
    -- Discount details (for discount-type subscriptions)
    discount_percentage DECIMAL(5, 2),
    max_discount_per_booking DECIMAL(10, 2),
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active' 
        CHECK (status IN ('active', 'paused', 'expired', 'cancelled')),
    
    -- Payment reference
    purchase_order_id UUID,
    amount_paid DECIMAL(10, 2),
    
    auto_renew BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_customer_sub_customer ON customer_subscriptions(customer_id);
CREATE INDEX idx_customer_sub_status ON customer_subscriptions(status);
CREATE INDEX idx_customer_sub_dates ON customer_subscriptions(start_date, end_date);
CREATE INDEX idx_customer_sub_category ON customer_subscriptions(service_category);
CREATE INDEX idx_customer_sub_active ON customer_subscriptions(customer_id, status, end_date) 
    WHERE status = 'active';

-- ============================================================================
-- DB-5: Scheduled Notifications
-- Fixes GAP: TV-1 - 5-minute pre-call notifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS scheduled_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL,
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('customer', 'vendor', 'staff', 'admin')),
    recipient_phone VARCHAR(20),
    recipient_email VARCHAR(255),
    
    -- Notification content
    title VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    data JSONB,
    
    -- Delivery settings
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
    sound VARCHAR(20) DEFAULT 'default',
    
    -- Scheduling
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    
    -- Related entity
    related_id UUID,
    related_type VARCHAR(50), -- booking, order, etc.
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_scheduled_notif_status ON scheduled_notifications(status);
CREATE INDEX idx_scheduled_notif_time ON scheduled_notifications(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_scheduled_notif_recipient ON scheduled_notifications(recipient_id, recipient_type);

-- ============================================================================
-- User Devices for Push Notifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('customer', 'vendor', 'staff', 'admin')),
    
    -- Device info
    device_token TEXT NOT NULL,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('android', 'ios', 'web', 'fcm', 'apns')),
    device_name VARCHAR(200),
    device_model VARCHAR(100),
    os_version VARCHAR(50),
    app_version VARCHAR(20),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_user_device UNIQUE (user_id, user_type, device_token)
);

CREATE INDEX idx_user_devices_user ON user_devices(user_id, user_type);
CREATE INDEX idx_user_devices_active ON user_devices(is_active) WHERE is_active = true;

-- ============================================================================
-- Additional Columns for Existing Tables
-- ============================================================================

-- Add missing columns to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS video_call_reminder_sent BOOLEAN DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS video_call_reminder_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vendor_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vendor_arrived_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS estimated_arrival_time TIMESTAMP WITH TIME ZONE;

-- Add photo column to staff table if missing
ALTER TABLE staff ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;

-- Add clarification notes to vendor_applications
ALTER TABLE vendor_applications ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE vendor_applications ADD COLUMN IF NOT EXISTS clarification_notes TEXT;
ALTER TABLE vendor_applications ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add scheduling policy to vendors
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS scheduling_policy JSONB DEFAULT '{
    "min_advance_hours": 1,
    "max_advance_days": 60,
    "buffer_between_appointments_minutes": 15,
    "slot_duration_minutes": 30,
    "allow_same_day": true,
    "allow_instant_booking": false
}'::jsonb;

-- Add subscription tracking to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES customer_subscriptions(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS subscription_booking BOOLEAN DEFAULT false;

-- ============================================================================
-- Commission Tiers Table
-- Fixes GAP: PM-5 - Tier-based commission
-- ============================================================================

CREATE TABLE IF NOT EXISTS commission_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_name VARCHAR(100) NOT NULL,
    tier_level INTEGER NOT NULL,
    
    -- Qualification criteria
    min_monthly_revenue DECIMAL(12, 2) DEFAULT 0,
    min_bookings_count INTEGER DEFAULT 0,
    min_rating DECIMAL(3, 2) DEFAULT 0,
    min_months_active INTEGER DEFAULT 0,
    
    -- Commission rates by service type
    default_commission_rate DECIMAL(5, 2) NOT NULL,
    booking_commission_rate DECIMAL(5, 2),
    pharmacy_commission_rate DECIMAL(5, 2),
    ecommerce_commission_rate DECIMAL(5, 2),
    
    -- Benefits
    priority_listing BOOLEAN DEFAULT false,
    featured_badge BOOLEAN DEFAULT false,
    dedicated_support BOOLEAN DEFAULT false,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add commission tier to vendors
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS commission_tier_id UUID REFERENCES commission_tiers(id);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5, 2) DEFAULT 15.00;

-- ============================================================================
-- Meal Plans for Nutritionist
-- Fixes GAP: NU-2 - Meal type filtering
-- ============================================================================

CREATE TABLE IF NOT EXISTS meal_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    
    -- Plan details
    name VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Type and purpose
    meal_type VARCHAR(50) NOT NULL CHECK (meal_type IN (
        'fresh', 'frozen', 'kibble', 'raw', 'home_cooked', 'therapeutic'
    )),
    purpose VARCHAR(100), -- weight_management, maintenance, puppy_growth, senior, allergies
    suitable_for JSONB, -- ['dog', 'cat'], breed restrictions, age groups
    
    -- Nutrition info
    calories_per_serving INTEGER,
    protein_percentage DECIMAL(5, 2),
    fat_percentage DECIMAL(5, 2),
    fiber_percentage DECIMAL(5, 2),
    ingredients JSONB,
    
    -- Pricing
    price_per_meal DECIMAL(10, 2) NOT NULL,
    subscription_price_daily DECIMAL(10, 2),
    subscription_price_weekly DECIMAL(10, 2),
    subscription_price_monthly DECIMAL(10, 2),
    
    -- Availability
    preparation_time_minutes INTEGER DEFAULT 30,
    is_available BOOLEAN DEFAULT true,
    max_daily_orders INTEGER,
    
    -- Media
    photos JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_meal_plans_vendor ON meal_plans(vendor_id);
CREATE INDEX idx_meal_plans_type ON meal_plans(meal_type);
CREATE INDEX idx_meal_plans_purpose ON meal_plans(purpose);
CREATE INDEX idx_meal_plans_available ON meal_plans(is_available);

-- ============================================================================
-- Problem Grid Mappings (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS problem_grid_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_id VARCHAR(100) NOT NULL,
    problem_name VARCHAR(200) NOT NULL,
    display_name VARCHAR(200),
    description TEXT,
    icon VARCHAR(100),
    emoji VARCHAR(10),
    category VARCHAR(100),
    
    -- Role associations
    role_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    vendor_types JSONB DEFAULT '["solo", "business"]'::jsonb,
    service_styles JSONB DEFAULT '["at_home", "at_center", "tele"]'::jsonb,
    
    -- Display order
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_problem_grid_problem ON problem_grid_mappings(problem_id);
CREATE INDEX idx_problem_grid_active ON problem_grid_mappings(is_active);

-- ============================================================================
-- Vendor Discounts Table
-- Fixes GAP: PM-2, PM-3 - Vendor vs platform discounts
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    
    -- Discount details
    name VARCHAR(200) NOT NULL,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN (
        'percentage', 'fixed', 'buy_x_get_y', 'bundle', 'first_time', 'loyalty'
    )),
    discount_value DECIMAL(10, 2) NOT NULL,
    
    -- Buy X Get Y specifics
    buy_quantity INTEGER,
    get_quantity INTEGER,
    get_discount_percentage DECIMAL(5, 2),
    
    -- Conditions
    min_order_value DECIMAL(10, 2),
    max_discount_amount DECIMAL(10, 2),
    applicable_services JSONB, -- service IDs or categories
    applicable_days JSONB, -- ['monday', 'tuesday']
    valid_time_start TIME,
    valid_time_end TIME,
    
    -- Validity
    start_date DATE,
    end_date DATE,
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    auto_apply BOOLEAN DEFAULT true, -- Apply automatically vs coupon code
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_vendor_discounts_vendor ON vendor_discounts(vendor_id);
CREATE INDEX idx_vendor_discounts_active ON vendor_discounts(is_active, start_date, end_date);

-- ============================================================================
-- Triggers
-- ============================================================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to new tables
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'updated_at' 
        AND table_schema = 'public'
        AND table_name IN (
            'staff_availability_per_style', 
            'gps_tracking_sessions', 
            'meal_subscriptions',
            'customer_subscriptions',
            'user_devices',
            'meal_plans',
            'vendor_discounts'
        )
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS update_%s_updated_at ON %I; 
             CREATE TRIGGER update_%s_updated_at 
             BEFORE UPDATE ON %I 
             FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
            t, t, t, t
        );
    END LOOP;
END $$;

-- ============================================================================
-- Insert Default Commission Tiers
-- ============================================================================

INSERT INTO commission_tiers (tier_name, tier_level, min_monthly_revenue, default_commission_rate, priority_listing)
VALUES 
    ('Bronze', 1, 0, 18.00, false),
    ('Silver', 2, 50000, 15.00, false),
    ('Gold', 3, 150000, 12.00, true),
    ('Platinum', 4, 500000, 10.00, true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Medical Records Table
-- Fixes GAP: PG-2, PG-3, TV-5, CC-5
-- ============================================================================

CREATE TABLE IF NOT EXISTS medical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id UUID NOT NULL REFERENCES pets(id),
    customer_id UUID,
    vendor_id UUID REFERENCES vendors(id),
    staff_id UUID REFERENCES staff(id),
    booking_id UUID REFERENCES bookings(id),
    
    -- Record type
    record_type VARCHAR(50) NOT NULL CHECK (record_type IN (
        'prescription', 'diagnostic_report', 'lab_result', 'vaccination',
        'consultation_notes', 'surgery_notes', 'diet_plan', 'imaging', 'other'
    )),
    
    -- Content
    title VARCHAR(500) NOT NULL,
    description TEXT,
    file_url TEXT,
    content_data JSONB, -- Structured data (medications, test results, etc.)
    
    -- Prescriber info
    prescribed_by UUID,
    prescribed_by_name VARCHAR(200),
    
    -- For diagnostics referrals
    referred_from_booking_id UUID REFERENCES bookings(id),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_medical_records_pet ON medical_records(pet_id);
CREATE INDEX idx_medical_records_customer ON medical_records(customer_id);
CREATE INDEX idx_medical_records_booking ON medical_records(booking_id);
CREATE INDEX idx_medical_records_type ON medical_records(record_type);
CREATE INDEX idx_medical_records_referral ON medical_records(referred_from_booking_id);

-- ============================================================================
-- Coupons Table (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(200),
    description TEXT,
    
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value DECIMAL(10, 2) NOT NULL,
    
    min_amount DECIMAL(10, 2),
    max_discount DECIMAL(10, 2),
    
    -- Restrictions
    vendor_id UUID REFERENCES vendors(id), -- NULL for platform-wide
    service_category VARCHAR(100),
    one_time_per_customer BOOLEAN DEFAULT true,
    
    -- Validity
    start_date DATE,
    end_date DATE,
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_active ON coupons(is_active, start_date, end_date);

-- Coupon usage tracking
CREATE TABLE IF NOT EXISTS coupon_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES coupons(id),
    customer_id UUID NOT NULL,
    booking_id UUID REFERENCES bookings(id),
    discount_amount DECIMAL(10, 2) NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_coupon_usage_coupon ON coupon_usage(coupon_id);
CREATE INDEX idx_coupon_usage_customer ON coupon_usage(customer_id);

-- ============================================================================
-- Promotions Table (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    title VARCHAR(300),
    description TEXT,
    
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value DECIMAL(10, 2) NOT NULL,
    
    min_order_value DECIMAL(10, 2),
    max_discount_amount DECIMAL(10, 2),
    
    -- Targeting
    target_category VARCHAR(100),
    target_service_style VARCHAR(20),
    is_spotlight BOOLEAN DEFAULT false,
    
    -- Display
    banner_image_url TEXT,
    display_order INTEGER DEFAULT 0,
    
    -- Validity
    start_date DATE,
    end_date DATE,
    
    is_active BOOLEAN DEFAULT true,
    published BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_promotions_active ON promotions(is_active, published);
CREATE INDEX idx_promotions_spotlight ON promotions(is_spotlight) WHERE is_spotlight = true;
CREATE INDEX idx_promotions_category ON promotions(target_category);

-- ============================================================================
-- Done
-- ============================================================================

COMMENT ON TABLE gps_tracking_sessions IS 'Real-time GPS tracking for home service visits';
COMMENT ON TABLE staff_availability_per_style IS 'Staff availability configured per service style (home/center/tele)';
COMMENT ON TABLE meal_subscriptions IS 'Customer meal subscription plans with nutritionists';
COMMENT ON TABLE customer_subscriptions IS 'Customer unlimited/membership subscriptions for zero-payment bookings';
COMMENT ON TABLE scheduled_notifications IS 'Queue for scheduled notifications like 5-min video call reminders';
