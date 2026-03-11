-- ============================================================================
-- VENDOR ONBOARDING COMMENTS TABLE
-- ============================================================================
-- Migration: Phase 1.2 - Vendor Onboarding State Machine
-- Date: 2025-01-28
-- 
-- Stores admin comments during vendor onboarding process
-- Allows vendors to see feedback and resume from any stage
-- ============================================================================

-- Add onboarding_progress column to vendors table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'onboarding_progress'
  ) THEN
    ALTER TABLE vendors ADD COLUMN onboarding_progress INTEGER DEFAULT 0 CHECK (onboarding_progress >= 0 AND onboarding_progress <= 100);
  END IF;
END $$;

-- Add metadata JSONB column to vendors table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE vendors ADD COLUMN metadata JSONB;
  END IF;
END $$;

-- Create vendor_onboarding_comments table
CREATE TABLE IF NOT EXISTS vendor_onboarding_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    admin_id UUID, -- References admin users (can be NULL for system comments)
    comment TEXT NOT NULL,
    comment_type TEXT DEFAULT 'clarification' CHECK (comment_type IN ('clarification', 'rejection', 'approval', 'general')),
    is_resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_vendor_onboarding_comments_vendor_id 
ON vendor_onboarding_comments(vendor_id);

CREATE INDEX IF NOT EXISTS idx_vendor_onboarding_comments_created_at 
ON vendor_onboarding_comments(created_at DESC);

-- Create vendor_onboarding_steps table to track completed steps
CREATE TABLE IF NOT EXISTS vendor_onboarding_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL, -- 'phone_verification', 'role_selection', 'form_submission', etc.
    step_data JSONB, -- Store step-specific data
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(vendor_id, step_name)
);

CREATE INDEX IF NOT EXISTS idx_vendor_onboarding_steps_vendor_id 
ON vendor_onboarding_steps(vendor_id);

-- Add comments
COMMENT ON TABLE vendor_onboarding_comments IS 'Admin comments during vendor onboarding process';
COMMENT ON COLUMN vendor_onboarding_comments.comment_type IS 'Type of comment: clarification, rejection, approval, or general';
COMMENT ON TABLE vendor_onboarding_steps IS 'Tracks completed steps in vendor onboarding process';

