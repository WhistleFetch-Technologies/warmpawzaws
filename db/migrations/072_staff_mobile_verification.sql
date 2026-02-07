-- ============================================================================
-- Migration: 072_staff_mobile_verification.sql
-- Description: Add mobile verification support for staff members
-- Date: 2025-01-28
-- ============================================================================

-- Add mobile_verified column to staff table
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS mobile_verified BOOLEAN DEFAULT false;

-- Add mobile_verified_at timestamp
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS mobile_verified_at TIMESTAMPTZ;

-- Add index for faster queries on verified staff
CREATE INDEX IF NOT EXISTS idx_staff_mobile_verified 
ON staff(mobile_verified) 
WHERE mobile_verified = true;

-- Add index for vendor_id + mobile_verified queries (for filtering)
CREATE INDEX IF NOT EXISTS idx_staff_vendor_verified 
ON staff(vendor_id, mobile_verified) 
WHERE mobile_verified = true;

-- Add comment
COMMENT ON COLUMN staff.mobile_verified IS 'Whether staff mobile number has been verified via OTP. Staff cannot go live until verified.';
COMMENT ON COLUMN staff.mobile_verified_at IS 'Timestamp when mobile number was verified.';

-- Update existing staff to have mobile_verified = false (they need to verify)
UPDATE staff 
SET mobile_verified = false 
WHERE mobile_verified IS NULL;
