-- ============================================================================
-- CREATE CRITICAL MISSING TABLES (Without problematic FKs)
-- ============================================================================

BEGIN;

-- CAPABILITIES (RBAC)
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

-- ROLE CAPABILITIES
CREATE TABLE IF NOT EXISTS role_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    capability_id UUID NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role_id, capability_id)
);

CREATE INDEX IF NOT EXISTS idx_role_capabilities_role_id ON role_capabilities(role_id);
CREATE INDEX IF NOT EXISTS idx_role_capabilities_capability_id ON role_capabilities(capability_id);

-- GPS TRACKING
CREATE TABLE IF NOT EXISTS gps_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    staff_id UUID,
    latitude NUMERIC(10, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,
    accuracy NUMERIC(10, 2),
    location_type VARCHAR(50),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gps_tracking_booking_id ON gps_tracking(booking_id);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_recorded_at ON gps_tracking(recorded_at DESC);

-- INSURANCE POLICIES (without pet_id FK for now)
CREATE TABLE IF NOT EXISTS insurance_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id TEXT NOT NULL UNIQUE,
    policy_number TEXT NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    pet_id UUID,
    plan_name TEXT NOT NULL,
    provider TEXT NOT NULL,
    policy_type TEXT NOT NULL,
    premium_amount NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_policies_customer_id ON insurance_policies(customer_id);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_policy_id ON insurance_policies(policy_id);

-- SEED CAPABILITIES
INSERT INTO capabilities (name, display_name, description, category, resource, action, is_system) VALUES
    ('booking:create', 'Create Bookings', 'Create new bookings', 'bookings', 'bookings', 'create', true),
    ('booking:read', 'View Bookings', 'View booking details', 'bookings', 'bookings', 'read', true),
    ('booking:update', 'Update Bookings', 'Update booking information', 'bookings', 'bookings', 'update', true),
    ('booking:delete', 'Delete Bookings', 'Cancel bookings', 'bookings', 'bookings', 'delete', true),
    ('booking:approve', 'Approve Bookings', 'Approve pending bookings', 'bookings', 'bookings', 'approve', true),
    ('payment:create', 'Process Payments', 'Process payments', 'payments', 'payments', 'create', true),
    ('payment:read', 'View Payments', 'View payment details', 'payments', 'payments', 'read', true),
    ('payment:refund', 'Process Refunds', 'Process refunds', 'payments', 'payments', 'refund', true),
    ('vendor:create', 'Create Vendors', 'Onboard vendors', 'vendors', 'vendors', 'create', true),
    ('vendor:read', 'View Vendors', 'View vendor details', 'vendors', 'vendors', 'read', true),
    ('vendor:update', 'Update Vendors', 'Update vendors', 'vendors', 'vendors', 'update', true),
    ('vendor:approve', 'Approve Vendors', 'Approve vendors', 'vendors', 'vendors', 'approve', true),
    ('customer:create', 'Create Customers', 'Register customers', 'customers', 'customers', 'create', true),
    ('customer:read', 'View Customers', 'View customers', 'customers', 'customers', 'read', true),
    ('customer:update', 'Update Customers', 'Update customers', 'customers', 'customers', 'update', true),
    ('service:create', 'Create Services', 'Create services', 'services', 'services', 'create', true),
    ('service:read', 'View Services', 'View services', 'services', 'services', 'read', true),
    ('service:update', 'Update Services', 'Update services', 'services', 'services', 'update', true),
    ('staff:create', 'Create Staff', 'Add staff', 'staff', 'staff', 'create', true),
    ('staff:read', 'View Staff', 'View staff', 'staff', 'staff', 'read', true),
    ('staff:update', 'Update Staff', 'Update staff', 'staff', 'staff', 'update', true),
    ('order:create', 'Create Orders', 'Process orders', 'orders', 'orders', 'create', true),
    ('order:read', 'View Orders', 'View orders', 'orders', 'orders', 'read', true),
    ('order:update', 'Update Orders', 'Update orders', 'orders', 'orders', 'update', true),
    ('finance:read', 'View Financial Data', 'View financials', 'finance', 'finance', 'read', true),
    ('finance:settlement', 'Process Settlements', 'Process settlements', 'finance', 'finance', 'settlement', true),
    ('platform:config', 'Configure Platform', 'Modify settings', 'platform', 'platform', 'config', true),
    ('platform:policies', 'Manage Policies', 'Manage policies', 'platform', 'policies', 'manage', true),
    ('platform:roles', 'Manage Roles', 'Manage roles', 'platform', 'roles', 'manage', true),
    ('platform:analytics', 'View Analytics', 'View analytics', 'platform', 'analytics', 'read', true),
    ('chat:send', 'Send Messages', 'Send messages', 'communication', 'chat', 'send', true),
    ('chat:read', 'View Messages', 'Read messages', 'communication', 'chat', 'read', true),
    ('gps:track', 'Track Location', 'Submit GPS data', 'tracking', 'gps', 'track', true),
    ('gps:view', 'View Tracking', 'View GPS data', 'tracking', 'gps', 'view', true),
    ('insurance:create', 'Create Policies', 'Create policies', 'insurance', 'insurance', 'create', true),
    ('insurance:read', 'View Policies', 'View policies', 'insurance', 'insurance', 'read', true),
    ('promotion:create', 'Create Promotions', 'Create promos', 'marketing', 'promotions', 'create', true),
    ('promotion:read', 'View Promotions', 'View promos', 'marketing', 'promotions', 'read', true),
    ('report:view', 'View Reports', 'View reports', 'reports', 'reports', 'read', true),
    ('audit:view', 'View Audit Logs', 'View audit logs', 'audit', 'audit', 'read', true),
    ('notification:send', 'Send Notifications', 'Send notifications', 'communication', 'notifications', 'send', true),
    ('dashboard:view', 'View Dashboard', 'Access dashboard', 'dashboard', 'dashboard', 'read', true),
    ('settings:update', 'Update Settings', 'Modify user settings', 'settings', 'settings', 'update', true),
    ('wallet:manage', 'Manage Wallet', 'Manage customer wallet', 'wallet', 'wallet', 'manage', true),
    ('review:moderate', 'Moderate Reviews', 'Moderate user reviews', 'reviews', 'reviews', 'moderate', true),
    ('support:access', 'Access Support', 'Access support features', 'support', 'support', 'access', true)
ON CONFLICT (name) DO NOTHING;

COMMIT;
