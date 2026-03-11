-- ============================================================================
-- MIGRATION 059: Customer State Management
-- ============================================================================
-- Purpose: Add proper state fields for customers (similar to vendors)
-- Date: 2025-01-12
-- 
-- This migration adds:
-- 1. status field to customers table
-- 2. onboarding_status field for customer onboarding flow
-- 3. profile_completed flag
-- 4. customer_identity table for OTP/auth state tracking
-- ============================================================================

-- ============================================================================
-- 1. ADD STATUS FIELD TO CUSTOMERS TABLE
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'status'
  ) THEN
    ALTER TABLE customers ADD COLUMN status TEXT DEFAULT 'new' CHECK (
      status IN ('new', 'onboarding', 'active', 'inactive', 'suspended')
    );
    COMMENT ON COLUMN customers.status IS 'Customer account status: new, onboarding, active, inactive, suspended';
  END IF;
END $$;

-- Update existing customers to 'active' if they have bookings or orders
DO $$
BEGIN
  UPDATE customers 
  SET status = 'active'
  WHERE status = 'new' 
    AND (
      EXISTS (SELECT 1 FROM bookings WHERE customer_id = customers.id)
      OR EXISTS (SELECT 1 FROM orders WHERE customer_id = customers.id)
    );
END $$;

-- ============================================================================
-- 2. ADD ONBOARDING_STATUS FIELD
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'onboarding_status'
  ) THEN
    ALTER TABLE customers ADD COLUMN onboarding_status TEXT DEFAULT 'INIT' CHECK (
      onboarding_status IN (
        'INIT',
        'PHONE_VERIFIED',
        'PROFILE_PENDING',
        'PET_PENDING',
        'PREFERENCES_PENDING',
        'COMPLETED'
      )
    );
    COMMENT ON COLUMN customers.onboarding_status IS 'Customer onboarding state: INIT, PHONE_VERIFIED, PROFILE_PENDING, PET_PENDING, PREFERENCES_PENDING, COMPLETED';
  END IF;
END $$;

-- ============================================================================
-- 3. ADD PROFILE COMPLETION FLAGS
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'profile_completed'
  ) THEN
    ALTER TABLE customers ADD COLUMN profile_completed BOOLEAN DEFAULT false;
    COMMENT ON COLUMN customers.profile_completed IS 'Whether customer has completed their profile (name, email, address, etc.)';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'profile_completed_at'
  ) THEN
    ALTER TABLE customers ADD COLUMN profile_completed_at TIMESTAMPTZ;
    COMMENT ON COLUMN customers.profile_completed_at IS 'Timestamp when profile was completed';
  END IF;
END $$;

-- Auto-set profile_completed for existing customers with complete data
DO $$
BEGIN
  UPDATE customers 
  SET profile_completed = true,
      profile_completed_at = COALESCE(profile_completed_at, updated_at)
  WHERE profile_completed = false
    AND full_name IS NOT NULL 
    AND full_name != ''
    AND (email IS NOT NULL OR phone IS NOT NULL)
    AND address IS NOT NULL;
END $$;

-- ============================================================================
-- 4. CREATE CUSTOMER IDENTITY TABLE (for OTP/auth state)
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_identity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    
    -- Onboarding State
    onboarding_status TEXT NOT NULL DEFAULT 'INIT' CHECK (
        onboarding_status IN (
            'INIT',
            'PHONE_VERIFIED',
            'PROFILE_PENDING',
            'PET_PENDING',
            'PREFERENCES_PENDING',
            'COMPLETED'
        )
    ),
    
    -- Current Step
    current_step TEXT, -- Current step in onboarding (e.g., 'profile', 'pets', 'preferences')
    
    -- Customer Reference
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_identity_phone ON customer_identity(phone);
CREATE INDEX IF NOT EXISTS idx_customer_identity_status ON customer_identity(onboarding_status);
CREATE INDEX IF NOT EXISTS idx_customer_identity_customer ON customer_identity(customer_id);

COMMENT ON TABLE customer_identity IS 'Customer identity and onboarding state - tracks OTP/auth and onboarding progress';
COMMENT ON COLUMN customer_identity.onboarding_status IS 'Current onboarding state';
COMMENT ON COLUMN customer_identity.current_step IS 'Current step in onboarding flow';

-- ============================================================================
-- 5. ADD CUSTOMER_IDENTITY_ID TO CUSTOMERS TABLE
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'customer_identity_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN customer_identity_id UUID REFERENCES customer_identity(id);
    COMMENT ON COLUMN customers.customer_identity_id IS 'Reference to customer_identity table for OTP/auth state';
  END IF;
END $$;

-- ============================================================================
-- 6. CREATE CUSTOMER PROFILE COMPLETION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_profile_completion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    
    -- Completion Flags
    basic_info_completed BOOLEAN DEFAULT false,
    address_completed BOOLEAN DEFAULT false,
    pet_profile_completed BOOLEAN DEFAULT false,
    preferences_completed BOOLEAN DEFAULT false,
    
    -- Completion Timestamps
    basic_info_completed_at TIMESTAMPTZ,
    address_completed_at TIMESTAMPTZ,
    pet_profile_completed_at TIMESTAMPTZ,
    preferences_completed_at TIMESTAMPTZ,
    
    -- Overall Status
    is_profile_complete BOOLEAN DEFAULT false,
    profile_completed_at TIMESTAMPTZ,
    
    -- Metadata
    completion_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(customer_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_profile_completion_customer ON customer_profile_completion(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_profile_completion_complete ON customer_profile_completion(is_profile_complete);

COMMENT ON TABLE customer_profile_completion IS 'Tracks customer profile completion status - gates full platform access';

-- ============================================================================
-- 7. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_onboarding_status ON customers(onboarding_status);
CREATE INDEX IF NOT EXISTS idx_customers_profile_completed ON customers(profile_completed) WHERE profile_completed = false;
CREATE INDEX IF NOT EXISTS idx_customers_identity_id ON customers(customer_identity_id);

-- ============================================================================
-- 8. MIGRATE EXISTING DATA
-- ============================================================================

-- Create customer_identity records for existing customers
DO $$
DECLARE
    customer_record RECORD;
    identity_id UUID;
BEGIN
    FOR customer_record IN SELECT id, phone, email FROM customers WHERE customer_identity_id IS NULL
    LOOP
        -- Create identity record
        INSERT INTO customer_identity (phone, email, customer_id, onboarding_status)
        VALUES (
            customer_record.phone,
            customer_record.email,
            customer_record.id,
            CASE 
                WHEN EXISTS (SELECT 1 FROM pets WHERE customer_id = customer_record.id) THEN 'COMPLETED'
                WHEN customer_record.email IS NOT NULL AND customer_record.email != '' THEN 'PROFILE_PENDING'
                ELSE 'PHONE_VERIFIED'
            END
        )
        RETURNING id INTO identity_id;
        
        -- Link customer to identity
        UPDATE customers 
        SET customer_identity_id = identity_id
        WHERE id = customer_record.id;
    END LOOP;
END $$;

-- Set onboarding_status based on existing data
DO $$
BEGIN
    -- Customers with pets are COMPLETED
    UPDATE customers 
    SET onboarding_status = 'COMPLETED'
    WHERE onboarding_status = 'INIT'
      AND EXISTS (SELECT 1 FROM pets WHERE customer_id = customers.id);
    
    -- Customers with email but no pets are PROFILE_PENDING
    UPDATE customers 
    SET onboarding_status = 'PROFILE_PENDING'
    WHERE onboarding_status = 'INIT'
      AND email IS NOT NULL 
      AND email != ''
      AND NOT EXISTS (SELECT 1 FROM pets WHERE customer_id = customers.id);
    
    -- Customers with just phone are PHONE_VERIFIED
    UPDATE customers 
    SET onboarding_status = 'PHONE_VERIFIED'
    WHERE onboarding_status = 'INIT'
      AND (email IS NULL OR email = '');
END $$;

-- Set status based on activity
DO $$
BEGIN
    -- Active customers (have bookings or orders)
    UPDATE customers 
    SET status = 'active'
    WHERE status = 'new'
      AND (
        EXISTS (SELECT 1 FROM bookings WHERE customer_id = customers.id)
        OR EXISTS (SELECT 1 FROM orders WHERE customer_id = customers.id)
      );
    
    -- Inactive customers (no activity in 90 days)
    UPDATE customers 
    SET status = 'inactive'
    WHERE status = 'new'
      AND last_login_at IS NOT NULL
      AND last_login_at < NOW() - INTERVAL '90 days';
END $$;
