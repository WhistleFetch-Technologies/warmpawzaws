-- ============================================================================
-- MIGRATION 302: Add Go Live Fields to Vendors Table
-- ============================================================================
-- Date: 2026-01-28
-- Purpose: Add go_live_at timestamp and go_live_checklist JSONB column to vendors table
-- Phase: Phase 1 - Vendor Go Live Foundation
-- 
-- IMPORTANT: This migration is idempotent and safe to re-run
-- ============================================================================

-- Add go_live_at timestamp column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vendors' AND column_name = 'go_live_at'
    ) THEN
        ALTER TABLE vendors ADD COLUMN go_live_at TIMESTAMPTZ;
        COMMENT ON COLUMN vendors.go_live_at IS 'Timestamp when vendor went live (activated)';
    END IF;
END $$;

-- Add go_live_checklist JSONB column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vendors' AND column_name = 'go_live_checklist'
    ) THEN
        ALTER TABLE vendors ADD COLUMN go_live_checklist JSONB DEFAULT '{}'::jsonb;
        COMMENT ON COLUMN vendors.go_live_checklist IS 'Stores go-live checklist completion status';
    END IF;
END $$;

-- Create index on go_live_at for faster queries
CREATE INDEX IF NOT EXISTS idx_vendors_go_live_at ON vendors(go_live_at) WHERE go_live_at IS NOT NULL;

-- Create index on go_live_checklist for faster JSON queries
CREATE INDEX IF NOT EXISTS idx_vendors_go_live_checklist ON vendors USING GIN(go_live_checklist);

-- Update existing active vendors to have go_live_at if they are already active
UPDATE vendors 
SET go_live_at = updated_at 
WHERE is_active = true 
  AND go_live_at IS NULL 
  AND status = 'active';

COMMENT ON TABLE vendors IS 'Vendor profiles with go-live tracking';
