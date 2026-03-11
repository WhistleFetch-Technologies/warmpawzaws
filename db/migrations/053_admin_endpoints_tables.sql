-- ============================================================================
-- ADMIN ENDPOINTS - MISSING TABLES MIGRATION
-- ============================================================================
-- This migration creates tables required by admin endpoints
-- Date: 2026-01-02
-- Purpose: Support all admin UI endpoints with proper database schema
-- ============================================================================

-- ============================================================================
-- SUPPORT TICKETS TABLE
-- ============================================================================
-- Used by: /admin/support/tickets, /admin/support/stats, /admin/support/vendor-tickets
CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number TEXT NOT NULL UNIQUE,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    description TEXT,
    
    -- Ticket Classification
    category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'technical', 'billing', 'account', 'service', 'other')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    
    -- Relationships
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    
    -- Customer Info (denormalized for performance)
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    
    -- Assignment
    assigned_to UUID, -- References admin users
    assigned_at TIMESTAMPTZ,
    
    -- Response Tracking
    first_response_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_customer_id ON support_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_vendor_id ON support_tickets(vendor_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at);

COMMENT ON TABLE support_tickets IS 'Customer and vendor support tickets';
COMMENT ON COLUMN support_tickets.ticket_number IS 'Auto-generated ticket number (e.g., TKT-20260102-001)';

-- ============================================================================
-- CHAT SESSIONS TABLE
-- ============================================================================
-- Used by: /admin/support/chat-sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Session Participants
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    
    -- Session Info
    session_type TEXT NOT NULL DEFAULT 'customer_support' CHECK (session_type IN ('customer_support', 'vendor_support', 'booking_chat')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
    
    -- Last Message Tracking
    last_message TEXT,
    last_message_at TIMESTAMPTZ,
    last_message_from TEXT, -- 'customer', 'vendor', 'admin'
    
    -- Unread Count
    unread_count INTEGER DEFAULT 0,
    customer_unread_count INTEGER DEFAULT 0,
    vendor_unread_count INTEGER DEFAULT 0,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_customer_id ON chat_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_vendor_id ON chat_sessions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_message_at ON chat_sessions(last_message_at DESC);

COMMENT ON TABLE chat_sessions IS 'Chat sessions for customer and vendor support';

-- ============================================================================
-- TRANSACTIONS TABLE
-- ============================================================================
-- Used by: /admin/transactions, /admin/transactions/stats, /admin/transactions/export
-- Note: This is a unified transactions table that aggregates from payments, refunds, payouts
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id TEXT NOT NULL UNIQUE, -- External transaction ID (Razorpay, etc.)
    
    -- Transaction Type
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('payment', 'refund', 'payout', 'commission', 'fee', 'adjustment')),
    transaction_category TEXT NOT NULL DEFAULT 'booking' CHECK (transaction_category IN ('booking', 'order', 'subscription', 'wallet', 'payout', 'other')),
    
    -- Relationships
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    refund_id UUID REFERENCES refunds(id) ON DELETE SET NULL,
    payout_id UUID REFERENCES payouts(id) ON DELETE SET NULL,
    
    -- Amount Details
    amount NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed', 'cancelled', 'refunded')),
    
    -- Payment Gateway Info
    gateway TEXT, -- 'razorpay', 'stripe', etc.
    gateway_transaction_id TEXT,
    gateway_response JSONB,
    
    -- Dates
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Metadata
    description TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_vendor_id ON transactions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_transactions_booking_id ON transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_gateway_id ON transactions(gateway_transaction_id);

COMMENT ON TABLE transactions IS 'Unified transactions table for all financial transactions';
COMMENT ON COLUMN transactions.transaction_id IS 'External transaction ID (e.g., Razorpay payment ID)';

-- ============================================================================
-- VENDOR PAYMENT RULES TABLE
-- ============================================================================
-- Used by: /admin/vendor-settings/payment-rules
CREATE TABLE IF NOT EXISTS vendor_payment_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    
    -- Rule Configuration
    vendor_types TEXT[], -- Array of vendor types this rule applies to (empty = all)
    service_location TEXT NOT NULL DEFAULT 'both' CHECK (service_location IN ('home', 'clinic', 'both')),
    reservation_type TEXT NOT NULL DEFAULT 'flat' CHECK (reservation_type IN ('flat', 'percentage')),
    
    -- Payment Configuration
    reservation_percentage NUMERIC(5, 2) CHECK (reservation_percentage BETWEEN 0 AND 100),
    flat_amount NUMERIC(10, 2) CHECK (flat_amount >= 0),
    minimum_advance_payment NUMERIC(10, 2) DEFAULT 0,
    partial_payment_allowed BOOLEAN DEFAULT true,
    
    -- Escrow Configuration
    escrow_hold_period_hours INTEGER DEFAULT 24,
    cancellation_grace_period_hours INTEGER DEFAULT 2,
    auto_capture_payment BOOLEAN DEFAULT true,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0, -- Higher priority rules are applied first
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_payment_rules_active ON vendor_payment_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_vendor_payment_rules_priority ON vendor_payment_rules(priority DESC);

COMMENT ON TABLE vendor_payment_rules IS 'Payment rules for vendor services';
COMMENT ON COLUMN vendor_payment_rules.vendor_types IS 'Array of vendor types (empty = applies to all)';

-- ============================================================================
-- VENDOR REFUND TIERS TABLE
-- ============================================================================
-- Used by: /admin/vendor-settings/refund-tiers
-- Note: Different from refund_tiers - this is vendor-specific
CREATE TABLE IF NOT EXISTS vendor_refund_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    
    -- Tier Configuration
    vendor_types TEXT[], -- Array of vendor types this tier applies to (empty = all)
    service_location TEXT NOT NULL DEFAULT 'both' CHECK (service_location IN ('home', 'clinic', 'both')),
    
    -- Refund Configuration
    hours_before_service INTEGER NOT NULL, -- Hours before service start time
    refund_percentage NUMERIC(5, 2) NOT NULL CHECK (refund_percentage BETWEEN 0 AND 100),
    cancellation_fee NUMERIC(10, 2) DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    tier_level INTEGER DEFAULT 0, -- Lower number = higher priority
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_refund_tiers_active ON vendor_refund_tiers(is_active);
CREATE INDEX IF NOT EXISTS idx_vendor_refund_tiers_level ON vendor_refund_tiers(tier_level ASC);

COMMENT ON TABLE vendor_refund_tiers IS 'Vendor-specific refund tiers';
COMMENT ON COLUMN vendor_refund_tiers.vendor_types IS 'Array of vendor types (empty = applies to all)';

-- ============================================================================
-- VENDOR SUPPORT REQUESTS TABLE (if needed)
-- ============================================================================
CREATE TABLE IF NOT EXISTS vendor_support_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    request_type TEXT NOT NULL CHECK (request_type IN ('technical', 'billing', 'account', 'service', 'other')),
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_to UUID, -- References admin users
    response TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_support_requests_vendor_id ON vendor_support_requests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_support_requests_status ON vendor_support_requests(status);

COMMENT ON TABLE vendor_support_requests IS 'Vendor-specific support requests';

-- ============================================================================
-- COMPLIANCE ISSUES TABLE (if needed)
-- ============================================================================
CREATE TABLE IF NOT EXISTS compliance_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    issue_type TEXT NOT NULL CHECK (issue_type IN ('document', 'verification', 'policy', 'quality', 'other')),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'dismissed')),
    assigned_to UUID, -- References admin users
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_issues_vendor_id ON compliance_issues(vendor_id);
CREATE INDEX IF NOT EXISTS idx_compliance_issues_status ON compliance_issues(status);
CREATE INDEX IF NOT EXISTS idx_compliance_issues_severity ON compliance_issues(severity);

COMMENT ON TABLE compliance_issues IS 'Vendor compliance issues tracking';

-- ============================================================================
-- INDEXES AND OPTIMIZATIONS
-- ============================================================================

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_support_tickets_vendor_status ON support_tickets(vendor_id, status) WHERE vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_vendor_date ON transactions(vendor_id, transaction_date DESC) WHERE vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_customer_date ON transactions(customer_id, transaction_date DESC) WHERE customer_id IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE support_tickets IS 'Support tickets for customer and vendor issues - used by /admin/support/* endpoints';
COMMENT ON TABLE chat_sessions IS 'Chat sessions for support - used by /admin/support/chat-sessions';
COMMENT ON TABLE transactions IS 'Unified transactions table - used by /admin/transactions/* endpoints';
COMMENT ON TABLE vendor_payment_rules IS 'Vendor payment rules - used by /admin/vendor-settings/payment-rules';
COMMENT ON TABLE vendor_refund_tiers IS 'Vendor refund tiers - used by /admin/vendor-settings/refund-tiers';
