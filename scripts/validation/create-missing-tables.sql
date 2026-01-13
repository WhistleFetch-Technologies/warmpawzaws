-- ============================================================================
-- CREATE MISSING CRITICAL TABLES
-- ============================================================================
-- This SQL creates the remaining tables needed for production readiness
-- ============================================================================

BEGIN;

-- ============================================================================
-- RBAC CAPABILITIES SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capabilities_category ON capabilities(category);
CREATE INDEX IF NOT EXISTS idx_capabilities_resource ON capabilities(resource);
CREATE INDEX IF NOT EXISTS idx_capabilities_active ON capabilities(is_active) WHERE is_active = true;

COMMENT ON TABLE capabilities IS 'System capabilities for RBAC';
COMMENT ON COLUMN capabilities.resource IS 'Resource type (e.g., bookings, payments, vendors)';
COMMENT ON COLUMN capabilities.action IS 'Action type (e.g., create, read, update, delete, approve)';

-- ============================================================================
-- ROLE-CAPABILITY MAPPING
-- ============================================================================

CREATE TABLE IF NOT EXISTS role_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    capability_id UUID NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
    granted_by UUID,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role_id, capability_id)
);

CREATE INDEX IF NOT EXISTS idx_role_capabilities_role_id ON role_capabilities(role_id);
CREATE INDEX IF NOT EXISTS idx_role_capabilities_capability_id ON role_capabilities(capability_id);

COMMENT ON TABLE role_capabilities IS 'Maps capabilities to roles for RBAC enforcement';

-- ============================================================================
-- GPS TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS gps_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    latitude NUMERIC(10, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,
    accuracy NUMERIC(10, 2),
    altitude NUMERIC(10, 2),
    speed NUMERIC(10, 2),
    heading NUMERIC(10, 2),
    location_type VARCHAR(50) CHECK (location_type IN ('start', 'in_transit', 'arrived', 'completed')),
    battery_level INTEGER CHECK (battery_level BETWEEN 0 AND 100),
    is_mock_location BOOLEAN DEFAULT false,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gps_tracking_booking_id ON gps_tracking(booking_id);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_staff_id ON gps_tracking(staff_id);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_recorded_at ON gps_tracking(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_location_type ON gps_tracking(location_type);

COMMENT ON TABLE gps_tracking IS 'GPS tracking data for service delivery and navigation';
COMMENT ON COLUMN gps_tracking.location_type IS 'Type of location update in service journey';

-- ============================================================================
-- GPS WAYPOINTS (for route optimization)
-- ============================================================================

CREATE TABLE IF NOT EXISTS gps_waypoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL,
    latitude NUMERIC(10, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,
    address TEXT,
    reached_at TIMESTAMPTZ,
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gps_waypoints_booking_id ON gps_waypoints(booking_id);
CREATE INDEX IF NOT EXISTS idx_gps_waypoints_sequence ON gps_waypoints(booking_id, sequence_number);

-- ============================================================================
-- INSURANCE POLICIES (simplified - avoiding FK conflicts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS insurance_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id TEXT NOT NULL UNIQUE,
    policy_number TEXT NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
    plan_name TEXT NOT NULL,
    provider TEXT NOT NULL,
    policy_type TEXT NOT NULL CHECK (policy_type IN ('accident_only', 'time_limited', 'maximum_benefit', 'lifetime')),
    coverage_details JSONB DEFAULT '{}'::jsonb,
    premium_amount NUMERIC(10, 2) NOT NULL,
    premium_frequency TEXT NOT NULL CHECK (premium_frequency IN ('monthly', 'quarterly', 'yearly')),
    deductible NUMERIC(10, 2) DEFAULT 0,
    max_coverage NUMERIC(10, 2),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'suspended')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    renewal_date DATE,
    next_premium_due DATE,
    last_premium_paid_at TIMESTAMPTZ,
    cancellation_date DATE,
    cancellation_reason TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_policies_customer_id ON insurance_policies(customer_id);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_pet_id ON insurance_policies(pet_id);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_policy_id ON insurance_policies(policy_id);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_status ON insurance_policies(status);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_renewal ON insurance_policies(renewal_date) WHERE is_active = true;

COMMENT ON TABLE insurance_policies IS 'Pet insurance policies purchased by customers';

-- ============================================================================
-- INSURANCE CLAIMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS insurance_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id TEXT NOT NULL UNIQUE,
    policy_id TEXT NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
    claim_type TEXT NOT NULL CHECK (claim_type IN ('accident', 'illness', 'routine_care', 'emergency', 'other')),
    claim_amount NUMERIC(10, 2) NOT NULL,
    approved_amount NUMERIC(10, 2),
    deductible_applied NUMERIC(10, 2) DEFAULT 0,
    claim_date DATE NOT NULL,
    incident_date DATE NOT NULL,
    incident_description TEXT NOT NULL,
    diagnosis TEXT,
    treatment_description TEXT,
    vet_name TEXT,
    vet_clinic TEXT,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'approved', 'rejected', 'paid', 'cancelled')),
    submission_date TIMESTAMPTZ DEFAULT NOW(),
    review_date TIMESTAMPTZ,
    approval_date TIMESTAMPTZ,
    payment_date TIMESTAMPTZ,
    rejection_reason TEXT,
    reviewer_notes TEXT,
    documents JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_claims_policy_id ON insurance_claims(policy_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_customer_id ON insurance_claims(customer_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_pet_id ON insurance_claims(pet_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_status ON insurance_claims(status);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_claim_date ON insurance_claims(claim_date DESC);

COMMENT ON TABLE insurance_claims IS 'Insurance claims submitted by customers';

-- ============================================================================
-- SEED ESSENTIAL CAPABILITIES
-- ============================================================================

INSERT INTO capabilities (name, display_name, description, category, resource, action, is_system) VALUES
    -- Booking Management
    ('booking:create', 'Create Bookings', 'Create new bookings', 'bookings', 'bookings', 'create', true),
    ('booking:read', 'View Bookings', 'View booking details', 'bookings', 'bookings', 'read', true),
    ('booking:update', 'Update Bookings', 'Update booking information', 'bookings', 'bookings', 'update', true),
    ('booking:delete', 'Delete Bookings', 'Cancel or delete bookings', 'bookings', 'bookings', 'delete', true),
    ('booking:approve', 'Approve Bookings', 'Approve pending bookings', 'bookings', 'bookings', 'approve', true),
    
    -- Payment Management
    ('payment:create', 'Process Payments', 'Process customer payments', 'payments', 'payments', 'create', true),
    ('payment:read', 'View Payments', 'View payment details', 'payments', 'payments', 'read', true),
    ('payment:refund', 'Process Refunds', 'Process payment refunds', 'payments', 'payments', 'refund', true),
    
    -- Vendor Management
    ('vendor:create', 'Create Vendors', 'Onboard new vendors', 'vendors', 'vendors', 'create', true),
    ('vendor:read', 'View Vendors', 'View vendor details', 'vendors', 'vendors', 'read', true),
    ('vendor:update', 'Update Vendors', 'Update vendor information', 'vendors', 'vendors', 'update', true),
    ('vendor:approve', 'Approve Vendors', 'Approve vendor applications', 'vendors', 'vendors', 'approve', true),
    ('vendor:suspend', 'Suspend Vendors', 'Suspend vendor accounts', 'vendors', 'vendors', 'suspend', true),
    
    -- Customer Management
    ('customer:create', 'Create Customers', 'Register new customers', 'customers', 'customers', 'create', true),
    ('customer:read', 'View Customers', 'View customer details', 'customers', 'customers', 'read', true),
    ('customer:update', 'Update Customers', 'Update customer information', 'customers', 'customers', 'update', true),
    
    -- Service Management
    ('service:create', 'Create Services', 'Create new services', 'services', 'services', 'create', true),
    ('service:read', 'View Services', 'View service catalog', 'services', 'services', 'read', true),
    ('service:update', 'Update Services', 'Update service details', 'services', 'services', 'update', true),
    ('service:delete', 'Delete Services', 'Remove services', 'services', 'services', 'delete', true),
    
    -- Staff Management
    ('staff:create', 'Create Staff', 'Add staff members', 'staff', 'staff', 'create', true),
    ('staff:read', 'View Staff', 'View staff details', 'staff', 'staff', 'read', true),
    ('staff:update', 'Update Staff', 'Update staff information', 'staff', 'staff', 'update', true),
    ('staff:delete', 'Delete Staff', 'Remove staff members', 'staff', 'staff', 'delete', true),
    
    -- Order Management
    ('order:create', 'Create Orders', 'Process customer orders', 'orders', 'orders', 'create', true),
    ('order:read', 'View Orders', 'View order details', 'orders', 'orders', 'read', true),
    ('order:update', 'Update Orders', 'Update order status', 'orders', 'orders', 'update', true),
    ('order:fulfill', 'Fulfill Orders', 'Mark orders as fulfilled', 'orders', 'orders', 'fulfill', true),
    
    -- Financial Management
    ('finance:read', 'View Financial Data', 'Access financial reports', 'finance', 'finance', 'read', true),
    ('finance:settlement', 'Process Settlements', 'Process vendor settlements', 'finance', 'finance', 'settlement', true),
    ('finance:payout', 'Process Payouts', 'Process vendor payouts', 'finance', 'finance', 'payout', true),
    
    -- Platform Configuration
    ('platform:config', 'Configure Platform', 'Modify platform settings', 'platform', 'platform', 'config', true),
    ('platform:policies', 'Manage Policies', 'Create and update policies', 'platform', 'policies', 'manage', true),
    ('platform:roles', 'Manage Roles', 'Create and assign roles', 'platform', 'roles', 'manage', true),
    ('platform:analytics', 'View Analytics', 'Access platform analytics', 'platform', 'analytics', 'read', true),
    
    -- Chat & Communication
    ('chat:send', 'Send Messages', 'Send chat messages', 'communication', 'chat', 'send', true),
    ('chat:read', 'View Messages', 'Read chat messages', 'communication', 'chat', 'read', true),
    
    -- GPS Tracking
    ('gps:track', 'Track Location', 'Submit GPS tracking data', 'tracking', 'gps', 'track', true),
    ('gps:view', 'View Tracking', 'View GPS tracking data', 'tracking', 'gps', 'view', true),
    
    -- Insurance
    ('insurance:create', 'Create Policies', 'Create insurance policies', 'insurance', 'insurance', 'create', true),
    ('insurance:read', 'View Policies', 'View insurance policies', 'insurance', 'insurance', 'read', true),
    ('insurance:claim', 'Process Claims', 'Process insurance claims', 'insurance', 'insurance', 'claim', true),
    
    -- Promotions
    ('promotion:create', 'Create Promotions', 'Create promotional campaigns', 'marketing', 'promotions', 'create', true),
    ('promotion:read', 'View Promotions', 'View promotions', 'marketing', 'promotions', 'read', true),
    ('promotion:update', 'Update Promotions', 'Update promotional campaigns', 'marketing', 'promotions', 'update', true)
ON CONFLICT (name) DO NOTHING;

COMMIT;

-- Verify tables created
SELECT 'Created tables:' as message;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('capabilities', 'role_capabilities', 'gps_tracking', 'insurance_policies', 'insurance_claims', 'gps_waypoints')
ORDER BY table_name;

-- Verify capabilities seeded
SELECT 'Seeded capabilities:' as message;
SELECT COUNT(*) as capability_count FROM capabilities;
