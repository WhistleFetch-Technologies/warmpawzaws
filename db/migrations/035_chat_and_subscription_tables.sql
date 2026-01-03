-- ============================================================================
-- CHAT MESSAGES AND SUBSCRIPTION TABLES
-- ============================================================================
-- Tables for chat functionality and subscription management
-- ============================================================================

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    sender_phone TEXT NOT NULL,
    sender_name TEXT,
    sender_type TEXT NOT NULL DEFAULT 'customer' CHECK (sender_type IN ('customer', 'vendor', 'staff', 'admin')),
    message TEXT NOT NULL,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'location')),
    file_id TEXT,
    file_name TEXT,
    file_type TEXT,
    file_size INTEGER,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_booking_id ON chat_messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_phone ON chat_messages(sender_phone);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- Subscription Plans
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    interval TEXT NOT NULL CHECK (interval IN ('monthly', 'yearly')),
    features JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_vendor_id ON subscription_plans(vendor_id);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_is_active ON subscription_plans(is_active);

-- Customer Subscriptions
CREATE TABLE IF NOT EXISTS customer_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'suspended')),
    start_date DATE NOT NULL,
    next_billing_date DATE NOT NULL,
    last_billed_at TIMESTAMPTZ,
    payment_method_id TEXT,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_customer_id ON customer_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_plan_id ON customer_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_vendor_id ON customer_subscriptions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_status ON customer_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_next_billing_date ON customer_subscriptions(next_billing_date);

-- Updated timestamp triggers
CREATE OR REPLACE FUNCTION update_subscription_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_subscription_plans_updated_at
    BEFORE UPDATE ON subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_subscription_plans_updated_at();

CREATE TRIGGER trigger_update_customer_subscriptions_updated_at
    BEFORE UPDATE ON customer_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_subscription_plans_updated_at();

