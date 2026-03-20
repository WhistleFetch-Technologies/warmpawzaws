-- ============================================================================
-- MIGRATION 037: Add Approval Fields to Banners Table
-- ============================================================================
-- Date: 2025-01-27
-- Purpose: Add approval status, approved_by, and approved_at columns to banners table
-- ============================================================================

-- Add approval fields to banners table if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'banners' 
    AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE banners 
    ADD COLUMN approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    ADD COLUMN approved_by UUID,
    ADD COLUMN approved_at TIMESTAMPTZ,
    ADD COLUMN target_audience TEXT DEFAULT 'all',
    ADD COLUMN applicable_services JSONB DEFAULT '[]'::jsonb;
    
    CREATE INDEX IF NOT EXISTS idx_banners_approval_status ON banners(approval_status);
  END IF;
END $$;

COMMENT ON COLUMN banners.approval_status IS 'Banner approval status: pending, approved, rejected';
COMMENT ON COLUMN banners.approved_by IS 'Admin user who approved the banner';
COMMENT ON COLUMN banners.approved_at IS 'Timestamp when banner was approved';
COMMENT ON COLUMN banners.target_audience IS 'Target audience: all, customer, vendor, specific_service';
COMMENT ON COLUMN banners.applicable_services IS 'Array of service IDs this banner applies to';

