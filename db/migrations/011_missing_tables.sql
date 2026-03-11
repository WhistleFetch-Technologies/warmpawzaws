-- ============================================================================
-- MISSING TABLES FOR SQL-BASED OPERATIONS
-- ============================================================================
-- Add tables that are referenced in SQL-based endpoints but may not exist
-- Date: 2025-01-22
-- ============================================================================

-- OTP Tokens table
CREATE TABLE IF NOT EXISTS otp_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_tokens_phone ON otp_tokens(phone);
CREATE INDEX IF NOT EXISTS idx_otp_tokens_code ON otp_tokens(code);
CREATE INDEX IF NOT EXISTS idx_otp_tokens_expires ON otp_tokens(expires_at);

-- Vendor Bank Details table
CREATE TABLE IF NOT EXISTS vendor_bank_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL,
  ifsc_code TEXT NOT NULL,
  account_holder_name TEXT NOT NULL,
  bank_name TEXT,
  branch_name TEXT,
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_bank_vendor ON vendor_bank_details(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_bank_verified ON vendor_bank_details(is_verified);

-- Add settled column to bookings if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'settled') THEN
    ALTER TABLE bookings ADD COLUMN settled BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'settled_at') THEN
    ALTER TABLE bookings ADD COLUMN settled_at TIMESTAMPTZ;
  END IF;
END $$;

-- Platform Revenue table (for tracking)
CREATE TABLE IF NOT EXISTS platform_revenue (
  revenue_date DATE PRIMARY KEY,
  total_revenue NUMERIC(10, 2) DEFAULT 0,
  commission_revenue NUMERIC(10, 2) DEFAULT 0,
  transaction_fees NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE otp_tokens IS 'OTP tokens for booking verification';
COMMENT ON TABLE vendor_bank_details IS 'Vendor bank account details for payouts';
COMMENT ON TABLE platform_revenue IS 'Daily platform revenue tracking';

