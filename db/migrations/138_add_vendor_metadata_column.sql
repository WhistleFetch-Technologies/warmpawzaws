-- ============================================================================
-- Migration: Add metadata column to vendors table
-- Description: Adds JSONB metadata column to store vacation mode, reapproval info, and other settings
-- Date: 2026-01-16
-- Issue: Vendor profile save fails with "column metadata of relation vendor does not exist"
-- ============================================================================

-- Add metadata column to vendors table
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add comment to document the column
COMMENT ON COLUMN vendors.metadata IS 'Stores vendor metadata including vacation_mode, reapproval information, and other settings';

-- Create index for better query performance on metadata
CREATE INDEX IF NOT EXISTS idx_vendors_metadata_gin ON vendors USING gin (metadata);

-- Example metadata structure:
-- {
--   "vacation_mode": {
--     "isActive": true,
--     "startDate": "2026-01-20",
--     "endDate": "2026-01-30",
--     "message": "Vendor is on vacation"
--   },
--   "previousStatus": "approved",
--   "wasApprovedBefore": true,
--   "reapprovalReason": "Critical profile fields updated",
--   "reapprovalRequestedAt": "2026-01-16T10:30:00Z"
-- }
