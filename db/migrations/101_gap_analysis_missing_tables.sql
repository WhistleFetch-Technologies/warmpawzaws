-- ============================================================================
-- GAP ANALYSIS - MISSING TABLES
-- ============================================================================
-- Date: 2026-01-21
-- ============================================================================

-- 1. staff_availability_per_style
CREATE TABLE IF NOT EXISTS staff_availability_per_style (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL,
    service_style VARCHAR(20) NOT NULL CHECK (service_style IN ('at_home', 'at_center', 'tele')),
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT true,
    max_appointments_per_slot INTEGER DEFAULT 1,
    slot_duration_minutes INTEGER DEFAULT 30,
    buffer_minutes INTEGER DEFAULT 15,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_avail_per_style_staff ON staff_availability_per_style(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_avail_per_style_style ON staff_availability_per_style(service_style);

-- 2. gps_location_history
CREATE TABLE IF NOT EXISTS gps_location_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(6, 2),
    heading DECIMAL(5, 2),
    speed DECIMAL(6, 2),
    eta_minutes INTEGER,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gps_loc_history_session ON gps_location_history(session_id);

-- 3. meal_subscription_deliveries
CREATE TABLE IF NOT EXISTS meal_subscription_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL,
    scheduled_date DATE NOT NULL,
    delivery_status VARCHAR(20) DEFAULT 'pending',
    delivery_partner_id UUID,
    pickup_otp VARCHAR(6),
    delivery_otp VARCHAR(6),
    tracking_session_id UUID,
    actual_delivery_time TIMESTAMP WITH TIME ZONE,
    customer_rating INTEGER,
    customer_feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meal_sub_delivery_sub ON meal_subscription_deliveries(subscription_id);
CREATE INDEX IF NOT EXISTS idx_meal_sub_delivery_date ON meal_subscription_deliveries(scheduled_date);

-- 4. scheduled_notifications
CREATE TABLE IF NOT EXISTS scheduled_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_type VARCHAR(50) NOT NULL,
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('customer', 'vendor', 'staff', 'admin')),
    recipient_id UUID NOT NULL,
    booking_id UUID,
    order_id UUID,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data JSONB,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    send_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sched_notif_status ON scheduled_notifications(status);
CREATE INDEX IF NOT EXISTS idx_sched_notif_send_at ON scheduled_notifications(send_at);
CREATE INDEX IF NOT EXISTS idx_sched_notif_recipient ON scheduled_notifications(recipient_id, recipient_type);

-- 5. user_devices (for push notifications)
CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('customer', 'vendor', 'staff', 'admin')),
    device_token TEXT NOT NULL,
    device_type VARCHAR(20) NOT NULL CHECK (device_type IN ('ios', 'android', 'web')),
    platform_endpoint_arn TEXT,
    device_name VARCHAR(100),
    app_version VARCHAR(20),
    os_version VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, user_type, device_token)
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user ON user_devices(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_user_devices_active ON user_devices(is_active) WHERE is_active = true;

-- 6. commission_tiers
CREATE TABLE IF NOT EXISTS commission_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_name VARCHAR(50) NOT NULL UNIQUE,
    tier_level INTEGER NOT NULL UNIQUE,
    min_monthly_revenue DECIMAL(12, 2) DEFAULT 0,
    max_monthly_revenue DECIMAL(12, 2),
    default_commission_rate DECIMAL(5, 2) NOT NULL,
    booking_commission_rate DECIMAL(5, 2),
    order_commission_rate DECIMAL(5, 2),
    pharmacy_commission_rate DECIMAL(5, 2),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed commission tiers
INSERT INTO commission_tiers (tier_name, tier_level, min_monthly_revenue, max_monthly_revenue, default_commission_rate, description) 
VALUES
    ('Bronze', 1, 0, 50000, 15.00, 'New vendors, up to ₹50,000/month'),
    ('Silver', 2, 50001, 150000, 12.00, 'Growing vendors, ₹50,001 - ₹1,50,000/month'),
    ('Gold', 3, 150001, 500000, 10.00, 'Established vendors, ₹1,50,001 - ₹5,00,000/month'),
    ('Platinum', 4, 500001, NULL, 8.00, 'Top vendors, above ₹5,00,000/month')
ON CONFLICT (tier_name) DO NOTHING;

-- 7. vendor_discounts
CREATE TABLE IF NOT EXISTS vendor_discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL,
    discount_name VARCHAR(100) NOT NULL,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'buy_x_get_y')),
    discount_value DECIMAL(10, 2) NOT NULL,
    buy_quantity INTEGER,
    get_quantity INTEGER,
    min_order_value DECIMAL(10, 2),
    max_discount_amount DECIMAL(10, 2),
    applicable_services JSONB,
    applicable_categories JSONB,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_discounts_vendor ON vendor_discounts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_discounts_active ON vendor_discounts(is_active, start_date, end_date);

-- 8. coupon_usage
CREATE TABLE IF NOT EXISTS coupon_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    booking_id UUID,
    order_id UUID,
    discount_amount DECIMAL(10, 2) NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon ON coupon_usage(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_customer ON coupon_usage(customer_id);

-- Add columns to existing tables
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS video_call_reminder_sent BOOLEAN DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS subscription_id UUID;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS subscription_booking BOOLEAN DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vendor_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vendor_arrived_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS estimated_arrival_time TIMESTAMP WITH TIME ZONE;

ALTER TABLE staff ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS photos JSONB;

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS commission_tier_id UUID;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5, 2);

ALTER TABLE vendor_onboarding_applications ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE vendor_onboarding_applications ADD COLUMN IF NOT EXISTS clarification_notes TEXT;
ALTER TABLE vendor_onboarding_applications ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Success message
SELECT 'Migration 101_gap_analysis_missing_tables.sql completed successfully' AS status;
