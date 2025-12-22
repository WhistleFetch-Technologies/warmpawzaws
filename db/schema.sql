-- ============================================================================
-- WARMPAWZ ECOSYSTEM - COMPLETE SQL SCHEMA
-- ============================================================================
-- Migration from KV-store to normalized SQL architecture
-- Date: 2024-12-22
-- 
-- This schema ensures:
-- 1. Every UI form field has explicit SQL representation
-- 2. All KV key patterns map to proper tables
-- 3. Normalized structure with foreign keys
-- 4. Proper constraints and data types
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search

-- ============================================================================
-- CORE ENTITIES - USERS & AUTHENTICATION
-- ============================================================================

-- Customers table
-- Maps: customer:{customerId} KV keys
-- UI Source: CustomerUserProfile component
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    full_name TEXT NOT NULL,
    date_of_birth DATE,
    gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    profile_photo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

COMMENT ON TABLE customers IS 'Customer profiles - maps from customer:{id} KV keys';
COMMENT ON COLUMN customers.phone IS 'Primary identifier from UI form';
COMMENT ON COLUMN customers.full_name IS 'From CustomerUserProfile form';

-- Vendors table
-- Maps: vendor:{vendorId} KV keys
-- UI Source: DynamicVendorOnboardingForm, AddVendorModal
CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    business_name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    alternate_phone TEXT,
    
    -- Business Details (from onboarding form)
    role_id UUID, -- References roles table
    category TEXT,
    experience_years INTEGER,
    registration_number TEXT,
    gst_number TEXT,
    pan_number TEXT,
    
    -- Location (from UI form)
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    pincode TEXT NOT NULL,
    landmark TEXT,
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    
    -- Status & Tier
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('new', 'onboarding', 'pending', 'approved', 'rejected', 'active', 'suspended', 'inactive')),
    tier TEXT DEFAULT 'Bronze' CHECK (tier IN ('Bronze', 'Silver', 'Gold', 'Platinum')),
    commission_percentage NUMERIC(5, 2) DEFAULT 15.00,
    
    -- Additional Details (from form)
    operating_hours TEXT,
    capacity INTEGER,
    specialization TEXT,
    
    -- Metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by UUID -- References admin users
);

COMMENT ON TABLE vendors IS 'Vendor profiles - maps from vendor:{id} KV keys';
COMMENT ON COLUMN vendors.business_name IS 'From DynamicVendorOnboardingForm.businessName';
COMMENT ON COLUMN vendors.owner_name IS 'From DynamicVendorOnboardingForm.ownerName';
COMMENT ON COLUMN vendors.role_id IS 'From DynamicVendorOnboardingForm.roleId';

-- Staff table
-- Maps: staff:{staffId} KV keys
-- UI Source: StaffFormModal in StaffManagement component
CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL,
    experience_years INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(vendor_id, phone)
);

COMMENT ON TABLE staff IS 'Staff members - maps from staff:{id} KV keys';
COMMENT ON COLUMN staff.name IS 'From StaffFormModal.name';
COMMENT ON COLUMN staff.role IS 'From StaffFormModal.role';

-- Staff Specializations (many-to-many)
CREATE TABLE staff_specializations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    specialization TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staff Certifications
CREATE TABLE staff_certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    certification_name TEXT NOT NULL,
    certification_url TEXT,
    issued_date DATE,
    expiry_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SERVICES & CATALOG
-- ============================================================================

-- Services table
-- Maps: service:{serviceId} KV keys
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    duration_minutes INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE services IS 'Services catalog - maps from service:{id} KV keys';

-- Service Categories
CREATE TABLE service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    parent_category_id UUID REFERENCES service_categories(id),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staff Services (many-to-many)
-- Maps: staff:{staffId}:service:{serviceId} KV keys
CREATE TABLE staff_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    price NUMERIC(10, 2),
    duration_minutes INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(staff_id, service_id)
);

COMMENT ON TABLE staff_services IS 'Maps from staff:{id}:service:{id} KV keys';

-- Vendor Service Areas
-- Maps: vendor:{id}:service_areas
CREATE TABLE vendor_service_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    area_name TEXT NOT NULL,
    city TEXT,
    state TEXT,
    pincode TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- BOOKINGS
-- ============================================================================

-- Bookings table
-- Maps: booking:{bookingId} KV keys
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    vendor_id UUID REFERENCES vendors(id),
    staff_id UUID REFERENCES staff(id),
    service_id UUID NOT NULL REFERENCES services(id),
    
    -- Booking Details
    booking_date DATE NOT NULL,
    booking_time TIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled')),
    
    -- Location
    service_type TEXT NOT NULL CHECK (service_type IN ('at_vendor', 'at_home', 'online')),
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    
    -- Pricing
    base_price NUMERIC(10, 2) NOT NULL,
    discount_amount NUMERIC(10, 2) DEFAULT 0,
    tax_amount NUMERIC(10, 2) DEFAULT 0,
    total_amount NUMERIC(10, 2) NOT NULL,
    loyalty_points_used INTEGER DEFAULT 0,
    coupon_code TEXT,
    promotion_id UUID,
    
    -- Package Booking
    is_package BOOLEAN DEFAULT false,
    package_id UUID,
    package_details JSONB,
    
    -- Payment
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid', 'refunded', 'failed')),
    payment_id UUID,
    
    -- OTP & Verification
    otp_code TEXT,
    otp_verified BOOLEAN DEFAULT false,
    otp_expires_at TIMESTAMPTZ,
    
    -- Metadata
    notes TEXT,
    cancellation_reason TEXT,
    rescheduled_from_booking_id UUID REFERENCES bookings(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ
);

COMMENT ON TABLE bookings IS 'Bookings - maps from booking:{id} KV keys';
COMMENT ON COLUMN bookings.booking_date IS 'From booking form date picker';
COMMENT ON COLUMN bookings.booking_time IS 'From booking form time picker';

-- Emergency Booking Queue
-- Maps: bookings:emergency:queue KV key
CREATE TABLE emergency_booking_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    queued_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_vendor_id UUID REFERENCES vendors(id),
    assigned_at TIMESTAMPTZ
);

-- Pending Reschedules
-- Maps: pending_reschedules KV key
CREATE TABLE pending_reschedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    requested_date DATE NOT NULL,
    requested_time TIME NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- ============================================================================
-- PAYMENTS
-- ============================================================================

-- Payments table
-- Maps: payment:{paymentId} KV keys
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id),
    order_id UUID REFERENCES orders(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    vendor_id UUID REFERENCES vendors(id),
    
    -- Payment Details
    amount NUMERIC(10, 2) NOT NULL,
    currency TEXT DEFAULT 'INR',
    payment_method TEXT NOT NULL CHECK (payment_method IN ('razorpay', 'wallet', 'cash', 'card', 'upi', 'netbanking')),
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded')),
    
    -- Razorpay Integration
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    razorpay_signature TEXT,
    
    -- Discounts & Promotions
    discount_amount NUMERIC(10, 2) DEFAULT 0,
    coupon_code TEXT,
    promotion_id UUID,
    loyalty_points_used INTEGER DEFAULT 0,
    wallet_amount_used NUMERIC(10, 2) DEFAULT 0,
    
    -- Metadata
    transaction_id TEXT,
    failure_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

COMMENT ON TABLE payments IS 'Payments - maps from payment:{id} KV keys';

-- Payment History (denormalized for quick access)
-- Maps: customer:{id}:payments, vendor:{id}:payments KV keys
CREATE TABLE payment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    vendor_id UUID REFERENCES vendors(id),
    amount NUMERIC(10, 2) NOT NULL,
    payment_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- REFUNDS
-- ============================================================================

-- Refunds table
-- Maps: refund:{refundId} KV keys
CREATE TABLE refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id),
    booking_id UUID REFERENCES bookings(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    vendor_id UUID REFERENCES vendors(id),
    
    -- Refund Details
    refund_amount NUMERIC(10, 2) NOT NULL,
    refund_reason TEXT NOT NULL,
    refund_status TEXT NOT NULL DEFAULT 'pending' CHECK (refund_status IN ('pending', 'approved', 'processing', 'completed', 'rejected', 'failed')),
    
    -- Razorpay Refund
    razorpay_refund_id TEXT,
    
    -- Metadata
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    rejection_reason TEXT
);

COMMENT ON TABLE refunds IS 'Refunds - maps from refund:{id} KV keys';

-- Refund Rules
-- Maps: payment:refund_rules, admin:refund_policies KV keys
CREATE TABLE refund_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('time_based', 'status_based', 'amount_based', 'custom')),
    rule_config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Refund Tiers
-- Maps: admin:refund_tiers, payment:tiers KV keys
CREATE TABLE refund_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_name TEXT NOT NULL UNIQUE,
    min_hours_before_booking INTEGER,
    refund_percentage NUMERIC(5, 2) NOT NULL CHECK (refund_percentage BETWEEN 0 AND 100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PAYOUTS
-- ============================================================================

-- Payouts table
-- Maps: payout:{payoutId} KV keys
CREATE TABLE payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    
    -- Payout Details
    amount NUMERIC(10, 2) NOT NULL,
    currency TEXT DEFAULT 'INR',
    payout_status TEXT NOT NULL DEFAULT 'pending' CHECK (payout_status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    
    -- Bank Details
    bank_account_number TEXT NOT NULL,
    ifsc_code TEXT NOT NULL,
    account_holder_name TEXT NOT NULL,
    
    -- Razorpay Payout
    razorpay_payout_id TEXT,
    
    -- Settlement
    settlement_id UUID REFERENCES settlements(id),
    
    -- Metadata
    payment_ids UUID[] NOT NULL, -- Array of payment IDs included in this payout
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failure_reason TEXT
);

COMMENT ON TABLE payouts IS 'Payouts - maps from payout:{id} KV keys';

-- Pending Payouts Queue
-- Maps: payouts:pending KV key
CREATE TABLE pending_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_id UUID NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    amount NUMERIC(10, 2) NOT NULL,
    queued_at TIMESTAMPTZ DEFAULT NOW(),
    priority INTEGER DEFAULT 5
);

-- ============================================================================
-- SETTLEMENTS
-- ============================================================================

-- Settlements table
-- Maps: pending_settlements, admin:settlements:pending KV keys
CREATE TABLE settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    
    -- Settlement Details
    total_amount NUMERIC(10, 2) NOT NULL,
    commission_amount NUMERIC(10, 2) NOT NULL,
    net_amount NUMERIC(10, 2) NOT NULL,
    settlement_status TEXT NOT NULL DEFAULT 'pending' CHECK (settlement_status IN ('pending', 'processing', 'completed', 'failed')),
    
    -- Period
    settlement_period_start DATE NOT NULL,
    settlement_period_end DATE NOT NULL,
    
    -- Metadata
    payment_ids UUID[] NOT NULL,
    payout_id UUID REFERENCES payouts(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Settlement Schedule
-- Maps: platform:settlement_schedule KV key
CREATE TABLE settlement_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id), -- NULL for global schedule
    schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'biweekly', 'monthly')),
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday
    day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 31),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ORDERS (E-COMMERCE)
-- ============================================================================

-- Orders table
-- Maps: order:{orderId} KV keys
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    vendor_id UUID REFERENCES vendors(id),
    
    -- Order Details
    order_number TEXT NOT NULL UNIQUE,
    order_status TEXT NOT NULL DEFAULT 'pending' CHECK (order_status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned')),
    
    -- Pricing
    subtotal NUMERIC(10, 2) NOT NULL,
    tax_amount NUMERIC(10, 2) DEFAULT 0,
    shipping_amount NUMERIC(10, 2) DEFAULT 0,
    discount_amount NUMERIC(10, 2) DEFAULT 0,
    total_amount NUMERIC(10, 2) NOT NULL,
    
    -- Shipping
    shipping_address TEXT NOT NULL,
    shipping_city TEXT NOT NULL,
    shipping_state TEXT NOT NULL,
    shipping_pincode TEXT NOT NULL,
    shipping_phone TEXT NOT NULL,
    
    -- Payment
    payment_id UUID REFERENCES payments(id),
    payment_status TEXT DEFAULT 'pending',
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ
);

COMMENT ON TABLE orders IS 'E-commerce orders - maps from order:{id} KV keys';

-- Order Items
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID, -- References products table (to be created)
    service_id UUID REFERENCES services(id),
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(10, 2) NOT NULL,
    total_price NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- WALLET
-- ============================================================================

-- Customer Wallets
CREATE TABLE customer_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL UNIQUE REFERENCES customers(id),
    balance NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wallet Transactions
CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES customer_wallets(id),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit', 'debit', 'refund', 'payout')),
    amount NUMERIC(10, 2) NOT NULL,
    balance_after NUMERIC(10, 2) NOT NULL,
    reference_type TEXT, -- 'payment', 'refund', 'topup', etc.
    reference_id UUID,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- BANKING & VERIFICATION
-- ============================================================================

-- Vendor Bank Details
-- Maps: vendor:{id}:bank_details
-- UI Source: DynamicVendorOnboardingForm banking section
CREATE TABLE vendor_bank_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL UNIQUE REFERENCES vendors(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    ifsc_code TEXT NOT NULL,
    account_holder_name TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE vendor_bank_details IS 'Maps from DynamicVendorOnboardingForm banking fields';
COMMENT ON COLUMN vendor_bank_details.bank_name IS 'From formData.bankName';
COMMENT ON COLUMN vendor_bank_details.account_number IS 'From formData.accountNumber';
COMMENT ON COLUMN vendor_bank_details.ifsc_code IS 'From formData.ifscCode';
COMMENT ON COLUMN vendor_bank_details.account_holder_name IS 'From formData.accountHolderName';

-- Bank Verification Records
CREATE TABLE bank_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    bank_detail_id UUID NOT NULL REFERENCES vendor_bank_details(id),
    verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'in_progress', 'verified', 'failed', 'rejected')),
    verification_method TEXT,
    verification_data JSONB,
    verified_at TIMESTAMPTZ,
    failure_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- DOCUMENTS & UPLOADS
-- ============================================================================

-- Vendor Documents
-- Maps: vendor:{id}:documents
-- UI Source: DynamicVendorOnboardingForm document uploads
CREATE TABLE vendor_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL, -- 'registration', 'gst', 'pan', 'license', etc.
    document_name TEXT NOT NULL,
    document_url TEXT NOT NULL,
    file_type TEXT,
    file_size BIGINT,
    is_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE vendor_documents IS 'Maps from DynamicVendorOnboardingForm document uploads';

-- ============================================================================
-- ROLES & PERMISSIONS
-- ============================================================================

-- Roles table
-- Maps: admin:roles:list, rbac:permissions:list KV keys
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE roles IS 'Maps from admin:roles:list KV key';
COMMENT ON COLUMN roles.name IS 'From DynamicVendorOnboardingForm.roleId';

-- Role Permissions (RBAC)
CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_name TEXT NOT NULL,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(role_id, permission_name, resource, action)
);

-- ============================================================================
-- PLATFORM SETTINGS
-- ============================================================================

-- Platform Settings
-- Maps: platform:settings, platform_settings KV keys
CREATE TABLE platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT NOT NULL UNIQUE,
    setting_value JSONB NOT NULL,
    setting_type TEXT NOT NULL CHECK (setting_type IN ('string', 'number', 'boolean', 'object', 'array')),
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platform Revenue
-- Maps: platform:revenue KV key
CREATE TABLE platform_revenue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revenue_date DATE NOT NULL,
    total_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
    commission_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
    transaction_fees NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(revenue_date)
);

-- GST Configuration
-- Maps: platform:gst_configs, platform:gst_rules KV keys
CREATE TABLE gst_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_name TEXT NOT NULL UNIQUE,
    gst_percentage NUMERIC(5, 2) NOT NULL CHECK (gst_percentage BETWEEN 0 AND 100),
    cgst_percentage NUMERIC(5, 2),
    sgst_percentage NUMERIC(5, 2),
    igst_percentage NUMERIC(5, 2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- HSN Codes
-- Maps: platform:hsn_codes KV key
CREATE TABLE hsn_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hsn_code TEXT NOT NULL UNIQUE,
    description TEXT,
    gst_rate NUMERIC(5, 2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tax Categories
-- Maps: platform:tax_categories KV key
CREATE TABLE tax_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_name TEXT NOT NULL UNIQUE,
    tax_rate NUMERIC(5, 2) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cancellation Policies
-- Maps: platform:cancellation_policies KV key
CREATE TABLE cancellation_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_name TEXT NOT NULL UNIQUE,
    description TEXT,
    hours_before_booking INTEGER NOT NULL,
    cancellation_fee_percentage NUMERIC(5, 2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ADMIN SETTINGS
-- ============================================================================

-- Admin Settings
-- Maps: admin:settings:* KV keys
CREATE TABLE admin_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_category TEXT NOT NULL, -- 'payment', 'payout', 'refund', 'schedule', 'sms', 'aws', etc.
    setting_key TEXT NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(setting_category, setting_key)
);

-- Payment Gateway Settings
-- Maps: admin:settings:payment_gateway, platform:settings:payment_gateway KV keys
CREATE TABLE payment_gateway_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gateway_name TEXT NOT NULL UNIQUE, -- 'razorpay', 'stripe', etc.
    gateway_config JSONB NOT NULL, -- API keys, secrets, etc.
    is_active BOOLEAN DEFAULT true,
    is_test_mode BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payout Rules
-- Maps: admin:settings:payout_rules, admin:payout:policies KV keys
CREATE TABLE payout_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name TEXT NOT NULL UNIQUE,
    min_payout_amount NUMERIC(10, 2) NOT NULL,
    processing_days INTEGER NOT NULL DEFAULT 3,
    fee_percentage NUMERIC(5, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Booking Rules
-- Maps: admin:booking_rules KV key
CREATE TABLE booking_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name TEXT NOT NULL UNIQUE,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('advance_booking', 'cancellation', 'rescheduling', 'payment', 'other')),
    rule_config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PROMOTIONS & COUPONS
-- ============================================================================

-- Promotions
-- Maps: platform:promotions, marketing:promotions, promotions:list KV keys
CREATE TABLE promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    promotion_type TEXT NOT NULL CHECK (promotion_type IN ('discount', 'cashback', 'loyalty_points', 'free_service')),
    discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC(10, 2),
    min_order_amount NUMERIC(10, 2),
    max_discount_amount NUMERIC(10, 2),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coupons
-- Maps: admin:coupons, coupons:list KV keys
CREATE TABLE coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC(10, 2) NOT NULL,
    min_order_amount NUMERIC(10, 2),
    max_uses INTEGER,
    uses_count INTEGER DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- REGIONS
-- ============================================================================

-- Regions
-- Maps: region_india, region:{regionId}, regions:list KV keys
CREATE TABLE regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    country TEXT DEFAULT 'India',
    region_config JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE regions IS 'Maps from region_india, region:{id} KV keys';

-- ============================================================================
-- SEARCH & ANALYTICS
-- ============================================================================

-- Search Index
-- Maps: search_index_master KV key
CREATE TABLE search_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL, -- 'vendor', 'service', 'staff', etc.
    entity_id UUID NOT NULL,
    search_text TEXT NOT NULL,
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', search_text)) STORED,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Search History
-- Maps: search_history_trie KV key
CREATE TABLE search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id),
    search_query TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    clicked_result_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Search Analytics
-- Maps: search-analytics KV key
CREATE TABLE search_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    search_date DATE NOT NULL,
    query TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    zero_results BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(search_date, query)
);

-- Popular Searches
-- Maps: search_popular KV key
CREATE TABLE popular_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL UNIQUE,
    search_count INTEGER DEFAULT 1,
    last_searched_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Zero Result Searches
-- Maps: search_zero_results KV key
CREATE TABLE zero_result_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL,
    search_count INTEGER DEFAULT 1,
    last_searched_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- STATISTICS & METRICS
-- ============================================================================

-- Vendor Statistics
-- Maps: stats:vendor:{vendorId}:{date} KV keys
CREATE TABLE vendor_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    stat_date DATE NOT NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    bookings INTEGER DEFAULT 0,
    revenue NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(vendor_id, stat_date)
);

-- Item Statistics
-- Maps: stats:item:{itemId}:{date} KV keys
CREATE TABLE item_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL,
    item_type TEXT NOT NULL, -- 'service', 'product', etc.
    stat_date DATE NOT NULL,
    views INTEGER DEFAULT 0,
    sales INTEGER DEFAULT 0,
    revenue NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(item_id, item_type, stat_date)
);

-- Performance Metrics
-- Maps: performance_metrics KV key
CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name TEXT NOT NULL,
    metric_value NUMERIC(10, 2) NOT NULL,
    metric_type TEXT NOT NULL, -- 'response_time', 'error_rate', 'throughput', etc.
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('customer', 'vendor', 'staff', 'admin')),
    recipient_id UUID NOT NULL,
    notification_type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    channels JSONB NOT NULL, -- {email: true, sms: true, inApp: true, push: false}
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification Templates
CREATE TABLE notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name TEXT NOT NULL UNIQUE,
    template_type TEXT NOT NULL,
    subject TEXT,
    body_text TEXT NOT NULL,
    body_html TEXT,
    channels JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reminder Queue
-- Maps: reminders:queue KV key
CREATE TABLE reminder_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id),
    reminder_type TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- OTP & VERIFICATION
-- ============================================================================

-- OTP Tokens
-- Maps: OTP-related KV operations
CREATE TABLE otp_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    email TEXT,
    code TEXT NOT NULL,
    purpose TEXT NOT NULL, -- 'login', 'verification', 'booking', etc.
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN DEFAULT false,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE otp_tokens IS 'OTP tokens with expiration - replaces KV TTL logic';

-- ============================================================================
-- PETS
-- ============================================================================

-- Pets
-- Maps: customer:{id}:pets KV keys
CREATE TABLE pets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    species TEXT NOT NULL, -- 'dog', 'cat', 'bird', etc.
    breed TEXT,
    age_years INTEGER,
    age_months INTEGER,
    gender TEXT CHECK (gender IN ('male', 'female', 'neutered', 'spayed')),
    weight_kg NUMERIC(5, 2),
    profile_photo_url TEXT,
    medical_history JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE pets IS 'Pet profiles - maps from customer:{id}:pets KV keys';

-- ============================================================================
-- E-COMMERCE CATALOG
-- ============================================================================

-- E-commerce Categories
-- Maps: ecommerce:categories, catalog:categories KV keys
CREATE TABLE ecommerce_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    parent_category_id UUID REFERENCES ecommerce_categories(id),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products
-- Maps: catalog:products KV key
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id),
    category_id UUID REFERENCES ecommerce_categories(id),
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT UNIQUE,
    price NUMERIC(10, 2) NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CACHE & TEMPORARY DATA
-- ============================================================================

-- Cache Tokens
-- Maps: cache:shiprocket:token, cache:* KV keys
CREATE TABLE cache_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key TEXT NOT NULL UNIQUE,
    cache_value TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE cache_tokens IS 'Cache tokens with expiration - replaces KV TTL logic';

-- Cache Statistics
-- Maps: cache_stats KV key
CREATE TABLE cache_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stat_date DATE NOT NULL UNIQUE,
    hits INTEGER DEFAULT 0,
    misses INTEGER DEFAULT 0,
    evictions INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- HEALTH CHECKS
-- ============================================================================

-- Health Checks
-- Maps: health:check, health:quick, health_check KV keys
CREATE TABLE health_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_type TEXT NOT NULL, -- 'full', 'quick', 'database', 'api', etc.
    status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
    details JSONB,
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FEATURED & SPECIAL
-- ============================================================================

-- Featured Vendors
-- Maps: featured:vendors KV key
CREATE TABLE featured_vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL UNIQUE REFERENCES vendors(id),
    display_order INTEGER DEFAULT 0,
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- LOYALTY & REWARDS
-- ============================================================================

-- Loyalty Rules
-- Maps: loyalty_rules KV key
CREATE TABLE loyalty_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name TEXT NOT NULL UNIQUE,
    points_per_rupee NUMERIC(5, 2) NOT NULL,
    redemption_rate NUMERIC(5, 2) NOT NULL, -- Points per rupee
    min_redemption_points INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer Loyalty Points
CREATE TABLE customer_loyalty_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL UNIQUE REFERENCES customers(id),
    total_points INTEGER DEFAULT 0 CHECK (total_points >= 0),
    lifetime_points_earned INTEGER DEFAULT 0,
    lifetime_points_redeemed INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loyalty Transactions
CREATE TABLE loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('earned', 'redeemed', 'expired', 'adjusted')),
    points INTEGER NOT NULL,
    reference_type TEXT, -- 'booking', 'payment', 'promotion', etc.
    reference_id UUID,
    description TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- REFERRAL SYSTEM
-- ============================================================================

-- Referrals
CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES customers(id),
    referred_id UUID REFERENCES customers(id),
    referral_code TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
    reward_points INTEGER DEFAULT 0,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SCHEDULE & AVAILABILITY
-- ============================================================================

-- Staff Schedules
-- Maps: staff:{id}:schedule KV keys
CREATE TABLE staff_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(staff_id, day_of_week, start_time)
);

-- Staff Availability Slots
-- Maps: staff:{id}:availability KV keys
CREATE TABLE staff_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(staff_id, date, start_time)
);

-- ============================================================================
-- SUBSCRIPTION TIERS
-- ============================================================================

-- Subscription Tiers
-- Maps: subscription_tiers:all, payment:tiers KV keys
CREATE TABLE subscription_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_name TEXT NOT NULL UNIQUE,
    tier_level INTEGER NOT NULL UNIQUE,
    monthly_price NUMERIC(10, 2) NOT NULL,
    features JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INTEGRATIONS
-- ============================================================================

-- Platform Integrations
-- Maps: platform:integrations:razorpay, platform:settings:aws KV keys
CREATE TABLE platform_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_name TEXT NOT NULL UNIQUE, -- 'razorpay', 'aws', 'google_maps', etc.
    integration_config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================

