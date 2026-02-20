-- ============================================================================
-- ENSURE OTP_TOKENS TABLE EXISTS (PRODUCTION FIX)
-- ============================================================================
-- This migration ensures the otp_tokens table exists with all required columns
-- Date: 2026-02-20
-- Safe to run multiple times (idempotent)
-- ============================================================================

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS otp_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  email TEXT,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add email column if missing
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'otp_tokens' AND column_name = 'email') THEN
    ALTER TABLE otp_tokens ADD COLUMN email TEXT;
  END IF;
END $$;

-- Add used_at column if missing
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'otp_tokens' AND column_name = 'used_at') THEN
    ALTER TABLE otp_tokens ADD COLUMN used_at TIMESTAMPTZ;
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_otp_tokens_phone ON otp_tokens(phone);
CREATE INDEX IF NOT EXISTS idx_otp_tokens_code ON otp_tokens(code);
CREATE INDEX IF NOT EXISTS idx_otp_tokens_expires ON otp_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_tokens_phone_code ON otp_tokens(phone, code) WHERE is_used = false;

COMMENT ON TABLE otp_tokens IS 'OTP tokens for authentication and verification';
