-- ============================================================================
-- MIGRATION 019: Payouts Admin Tracking Fields
-- ============================================================================
-- Date: 2025-01-28
-- Purpose: Add admin tracking fields to payouts table for admin management
-- ============================================================================

-- Add admin tracking fields to payouts table
ALTER TABLE payouts
ADD COLUMN IF NOT EXISTS approved_by UUID,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_by UUID,
ADD COLUMN IF NOT EXISTS rejected_by UUID,
ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS transaction_id TEXT;

COMMENT ON COLUMN payouts.approved_by IS 'Admin user ID who approved the payout';
COMMENT ON COLUMN payouts.approved_at IS 'Timestamp when payout was approved';
COMMENT ON COLUMN payouts.completed_by IS 'Admin user ID who completed the payout';
COMMENT ON COLUMN payouts.rejected_by IS 'Admin user ID who rejected the payout';
COMMENT ON COLUMN payouts.failed_at IS 'Timestamp when payout failed';
COMMENT ON COLUMN payouts.admin_notes IS 'Admin notes for payout processing';
COMMENT ON COLUMN payouts.transaction_id IS 'External transaction ID (e.g., Razorpay)';

