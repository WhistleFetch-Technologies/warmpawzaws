-- ============================================================================
-- MIGRATION 052: Seller Approval Workflow
-- ============================================================================
-- Date: 2026-01-XX
-- Purpose: Add seller status tracking for e-commerce product sellers
-- ============================================================================

-- Add seller_status column to vendors table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'seller_status'
  ) THEN
    ALTER TABLE vendors ADD COLUMN seller_status TEXT DEFAULT 'not_applied' CHECK (
      seller_status IN (
        'not_applied',
        'pending',
        'approved',
        'rejected'
      )
    );
    COMMENT ON COLUMN vendors.seller_status IS 'E-commerce seller approval status: not_applied, pending, approved, rejected';
  END IF;
END $$;

-- Add seller approval tracking columns
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'seller_approved_at'
  ) THEN
    ALTER TABLE vendors ADD COLUMN seller_approved_at TIMESTAMPTZ;
    COMMENT ON COLUMN vendors.seller_approved_at IS 'Timestamp when seller was approved';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'seller_approved_by'
  ) THEN
    ALTER TABLE vendors ADD COLUMN seller_approved_by UUID;
    COMMENT ON COLUMN vendors.seller_approved_by IS 'Admin user ID who approved the seller';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendors' AND column_name = 'seller_rejection_reason'
  ) THEN
    ALTER TABLE vendors ADD COLUMN seller_rejection_reason TEXT;
    COMMENT ON COLUMN vendors.seller_rejection_reason IS 'Reason for seller rejection';
  END IF;
END $$;

-- Create index for faster seller queries
CREATE INDEX IF NOT EXISTS idx_vendors_seller_status ON vendors(seller_status) WHERE seller_status IN ('pending', 'approved');

-- Create index for vendors with product_seller role
CREATE INDEX IF NOT EXISTS idx_vendors_product_seller_role ON vendors(role_id) WHERE seller_status = 'pending';

COMMENT ON TABLE vendors IS 'Vendor profiles - seller_status tracks e-commerce seller approval separately from vendor approval';

