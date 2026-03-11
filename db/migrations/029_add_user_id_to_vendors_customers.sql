-- ============================================================================
-- MIGRATION 029: Add user_id to vendors and customers tables
-- ============================================================================
-- Date: 2024-12-23
-- Purpose: Add user_id column to link vendors/customers to user accounts
-- 
-- This migration adds user_id UUID columns to vendors and customers tables
-- to support the authentication system that was migrated from KV to SQL
-- ============================================================================

-- Add user_id to vendors table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE vendors ADD COLUMN user_id UUID;
    CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON vendors(user_id);
    COMMENT ON COLUMN vendors.user_id IS 'UUID reference to user account - used for authentication';
  END IF;
END $$;

-- Add user_id to customers table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN user_id UUID;
    CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
    COMMENT ON COLUMN customers.user_id IS 'UUID reference to user account - used for authentication';
  END IF;
END $$;

