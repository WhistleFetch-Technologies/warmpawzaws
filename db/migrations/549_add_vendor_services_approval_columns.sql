-- ============================================================================
-- MIGRATION: Add approval workflow columns to vendor_services table
-- Version: 549
-- Description: Adds submitted_for_approval_at and other approval workflow columns
--              for custom service approval workflow
-- ============================================================================

-- Add submitted_for_approval_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendor_services' AND column_name = 'submitted_for_approval_at'
  ) THEN
    ALTER TABLE vendor_services 
    ADD COLUMN submitted_for_approval_at TIMESTAMPTZ;
    
    COMMENT ON COLUMN vendor_services.submitted_for_approval_at IS 
      'Timestamp when service was submitted for admin approval';
    
    RAISE NOTICE 'Added submitted_for_approval_at column to vendor_services table';
  ELSE
    RAISE NOTICE 'Column submitted_for_approval_at already exists in vendor_services table';
  END IF;
END $$;

-- Add approved_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendor_services' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE vendor_services 
    ADD COLUMN approved_at TIMESTAMPTZ;
    
    COMMENT ON COLUMN vendor_services.approved_at IS 
      'Timestamp when service was approved by admin';
    
    RAISE NOTICE 'Added approved_at column to vendor_services table';
  ELSE
    RAISE NOTICE 'Column approved_at already exists in vendor_services table';
  END IF;
END $$;

-- Add approved_by column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendor_services' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE vendor_services 
    ADD COLUMN approved_by TEXT;
    
    COMMENT ON COLUMN vendor_services.approved_by IS 
      'Admin user ID who approved the service';
    
    RAISE NOTICE 'Added approved_by column to vendor_services table';
  ELSE
    RAISE NOTICE 'Column approved_by already exists in vendor_services table';
  END IF;
END $$;

-- Add admin_note column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendor_services' AND column_name = 'admin_note'
  ) THEN
    ALTER TABLE vendor_services 
    ADD COLUMN admin_note TEXT;
    
    COMMENT ON COLUMN vendor_services.admin_note IS 
      'Notes from admin during approval/rejection';
    
    RAISE NOTICE 'Added admin_note column to vendor_services table';
  ELSE
    RAISE NOTICE 'Column admin_note already exists in vendor_services table';
  END IF;
END $$;

-- Add rejected_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendor_services' AND column_name = 'rejected_at'
  ) THEN
    ALTER TABLE vendor_services 
    ADD COLUMN rejected_at TIMESTAMPTZ;
    
    COMMENT ON COLUMN vendor_services.rejected_at IS 
      'Timestamp when service was rejected by admin';
    
    RAISE NOTICE 'Added rejected_at column to vendor_services table';
  ELSE
    RAISE NOTICE 'Column rejected_at already exists in vendor_services table';
  END IF;
END $$;

-- Add rejected_by column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendor_services' AND column_name = 'rejected_by'
  ) THEN
    ALTER TABLE vendor_services 
    ADD COLUMN rejected_by TEXT;
    
    COMMENT ON COLUMN vendor_services.rejected_by IS 
      'Admin user ID who rejected the service';
    
    RAISE NOTICE 'Added rejected_by column to vendor_services table';
  ELSE
    RAISE NOTICE 'Column rejected_by already exists in vendor_services table';
  END IF;
END $$;

-- Add rejection_reason column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendor_services' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE vendor_services 
    ADD COLUMN rejection_reason TEXT;
    
    COMMENT ON COLUMN vendor_services.rejection_reason IS 
      'Reason for rejection, shown to vendor';
    
    RAISE NOTICE 'Added rejection_reason column to vendor_services table';
  ELSE
    RAISE NOTICE 'Column rejection_reason already exists in vendor_services table';
  END IF;
END $$;

-- Add change_requested_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendor_services' AND column_name = 'change_requested_at'
  ) THEN
    ALTER TABLE vendor_services 
    ADD COLUMN change_requested_at TIMESTAMPTZ;
    
    COMMENT ON COLUMN vendor_services.change_requested_at IS 
      'Timestamp when changes were requested';
    
    RAISE NOTICE 'Added change_requested_at column to vendor_services table';
  ELSE
    RAISE NOTICE 'Column change_requested_at already exists in vendor_services table';
  END IF;
END $$;

-- Add change_requested_by column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendor_services' AND column_name = 'change_requested_by'
  ) THEN
    ALTER TABLE vendor_services 
    ADD COLUMN change_requested_by TEXT;
    
    COMMENT ON COLUMN vendor_services.change_requested_by IS 
      'Admin user ID who requested changes';
    
    RAISE NOTICE 'Added change_requested_by column to vendor_services table';
  ELSE
    RAISE NOTICE 'Column change_requested_by already exists in vendor_services table';
  END IF;
END $$;

-- Add change_request_reason column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'vendor_services' AND column_name = 'change_request_reason'
  ) THEN
    ALTER TABLE vendor_services 
    ADD COLUMN change_request_reason TEXT;
    
    COMMENT ON COLUMN vendor_services.change_request_reason IS 
      'Details of requested changes, shown to vendor';
    
    RAISE NOTICE 'Added change_request_reason column to vendor_services table';
  ELSE
    RAISE NOTICE 'Column change_request_reason already exists in vendor_services table';
  END IF;
END $$;

-- Create index for pending approval queries
CREATE INDEX IF NOT EXISTS idx_vendor_services_pending_approval 
ON vendor_services(submitted_for_approval_at) 
WHERE publish_status = 'pending_approval' AND is_custom_service = true;

-- Create index for custom services
CREATE INDEX IF NOT EXISTS idx_vendor_services_custom 
ON vendor_services(vendor_id, is_custom_service) 
WHERE is_custom_service = true;

-- ============================================================================
-- END OF MIGRATION 549
-- ============================================================================
