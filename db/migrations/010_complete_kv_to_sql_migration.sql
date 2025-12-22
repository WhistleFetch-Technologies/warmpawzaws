-- ============================================================================
-- COMPLETE KV TO SQL MIGRATION
-- ============================================================================
-- This migration adds all missing tables and constraints needed for
-- complete SQL-based implementation
-- Date: 2025-01-22
-- ============================================================================

-- ============================================================================
-- SERVICE PUBLISHING
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_publishing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  publish_status TEXT NOT NULL DEFAULT 'draft' CHECK (publish_status IN ('draft', 'pending', 'published', 'rejected')),
  service_style TEXT NOT NULL CHECK (service_style IN ('at_center', 'at_home', 'tele', 'at_clinic', 'video_consultation', 'home_visit')),
  published_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service_id, vendor_id, service_style)
);

CREATE INDEX idx_service_publishing_vendor_status ON service_publishing(vendor_id, publish_status);
CREATE INDEX idx_service_publishing_style_status ON service_publishing(service_style, publish_status);

-- ============================================================================
-- PACKAGE SERVICES JUNCTION
-- ============================================================================

CREATE TABLE IF NOT EXISTS package_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL, -- References packages table (to be created)
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(package_id, service_id)
);

-- ============================================================================
-- BOOKING STATE MACHINE
-- ============================================================================

CREATE TABLE IF NOT EXISTS booking_state_transitions (
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  allowed BOOLEAN DEFAULT false,
  PRIMARY KEY (from_status, to_status)
);

-- Insert valid state transitions
INSERT INTO booking_state_transitions (from_status, to_status, allowed) VALUES
  ('pending', 'confirmed', true),
  ('pending', 'cancelled', true),
  ('confirmed', 'in_progress', true),
  ('confirmed', 'cancelled', true),
  ('in_progress', 'completed', true),
  ('in_progress', 'cancelled', true),
  ('completed', 'completed', true), -- Terminal state
  ('cancelled', 'cancelled', true)  -- Terminal state
ON CONFLICT (from_status, to_status) DO NOTHING;

-- ============================================================================
-- DISPUTES
-- ============================================================================

CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  order_id UUID REFERENCES orders(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  dispute_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'closed')),
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ============================================================================
-- AUDIT LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  actor_id UUID,
  actor_type TEXT,
  changes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_type, actor_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- ============================================================================
-- PAYOUT POLICIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS payout_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_name TEXT NOT NULL UNIQUE,
  hold_period_days INTEGER DEFAULT 7,
  min_payout_amount NUMERIC(10, 2) DEFAULT 1000,
  auto_payout BOOLEAN DEFAULT false,
  payout_period TEXT DEFAULT 'weekly' CHECK (payout_period IN ('daily', 'weekly', 'biweekly', 'monthly')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default payout policy
INSERT INTO payout_policies (policy_name, hold_period_days, min_payout_amount, auto_payout, payout_period, is_active) VALUES
  ('Default Payout Policy', 7, 1000, true, 'weekly', true)
ON CONFLICT (policy_name) DO NOTHING;

-- ============================================================================
-- VENDOR EARNINGS TRACKING
-- ============================================================================

-- Add missing columns to vendors table if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'total_earnings') THEN
    ALTER TABLE vendors ADD COLUMN total_earnings NUMERIC(10, 2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'pending_payout') THEN
    ALTER TABLE vendors ADD COLUMN pending_payout NUMERIC(10, 2) DEFAULT 0;
  END IF;
END $$;

-- ============================================================================
-- CAPABILITY ENFORCEMENT
-- ============================================================================

-- Ensure role_permissions table has proper structure
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_name TEXT NOT NULL,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, permission_name, resource, action)
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_name);

-- ============================================================================
-- GST CONFIGURATION
-- ============================================================================

-- Ensure gst_configs table exists with proper structure
CREATE TABLE IF NOT EXISTS gst_configs (
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

-- Insert default GST configs
INSERT INTO gst_configs (config_name, gst_percentage, cgst_percentage, sgst_percentage, is_active) VALUES
  ('Standard Service GST', 18, 9, 9, true),
  ('Food Products GST', 5, 2.5, 2.5, true),
  ('Medicine GST', 12, 6, 6, true),
  ('No GST', 0, 0, 0, true)
ON CONFLICT (config_name) DO NOTHING;

-- Add gst_config_id to services table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'gst_config_id') THEN
    ALTER TABLE services ADD COLUMN gst_config_id UUID REFERENCES gst_configs(id);
  END IF;
END $$;

-- ============================================================================
-- ADDITIONAL INDEXES FOR PERFORMANCE
-- ============================================================================

-- Service Discovery Indexes
CREATE INDEX IF NOT EXISTS idx_services_vendor_publish ON services(vendor_id, is_active);
CREATE INDEX IF NOT EXISTS idx_services_category_active ON services(category, is_active);

-- Booking Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_vendor_status ON bookings(vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_status ON bookings(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_date_time ON bookings(booking_date, booking_time);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);

-- Payment Indexes
CREATE INDEX IF NOT EXISTS idx_payments_vendor_status ON payments(vendor_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_customer_status ON payments(customer_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order ON payments(razorpay_order_id);

-- Payout Indexes
CREATE INDEX IF NOT EXISTS idx_payouts_vendor_status ON payouts(vendor_id, payout_status);
CREATE INDEX IF NOT EXISTS idx_payouts_created_pending ON payouts(created_at) WHERE payout_status = 'pending';

-- ============================================================================
-- TRIGGERS FOR AUDIT TRAIL
-- ============================================================================

-- Function to log changes
CREATE OR REPLACE FUNCTION log_audit_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (entity_type, entity_id, action, changes, created_at)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    ),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for critical tables
DROP TRIGGER IF EXISTS audit_payments ON payments;
CREATE TRIGGER audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

DROP TRIGGER IF EXISTS audit_payouts ON payouts;
CREATE TRIGGER audit_payouts
  AFTER INSERT OR UPDATE OR DELETE ON payouts
  FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

DROP TRIGGER IF EXISTS audit_bookings ON bookings;
CREATE TRIGGER audit_bookings
  AFTER INSERT OR UPDATE OR DELETE ON bookings
  FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

-- ============================================================================
-- STATE MACHINE VALIDATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_booking_state_transition(
  old_status TEXT,
  new_status TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  IF old_status = new_status THEN
    RETURN true; -- Same state is always allowed
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM booking_state_transitions
    WHERE from_status = old_status
      AND to_status = new_status
      AND allowed = true
  );
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce state machine
CREATE OR REPLACE FUNCTION enforce_booking_state_machine()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT validate_booking_state_transition(OLD.status, NEW.status) THEN
    RAISE EXCEPTION 'Invalid state transition from % to %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS booking_state_machine ON bookings;
CREATE TRIGGER booking_state_machine
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION enforce_booking_state_machine();

COMMENT ON TABLE service_publishing IS 'Service publishing status - replaces vendor_services KV pattern';
COMMENT ON TABLE package_services IS 'Package to service mapping - replaces package KV structure';
COMMENT ON TABLE booking_state_transitions IS 'Valid booking state transitions';
COMMENT ON TABLE disputes IS 'Customer-vendor disputes';
COMMENT ON TABLE audit_logs IS 'Complete audit trail for all operations';
COMMENT ON TABLE payout_policies IS 'Payout processing policies';

