-- ============================================================================
-- MIGRATION 216: Support Solo Vendors in Tele Queue
-- ============================================================================
-- Adds support for solo vendors (vendors without staff) in tele_queue table
-- Date: 2026-01-28
-- ============================================================================

-- Step 1: Add vendor_id column to tele_queue
ALTER TABLE tele_queue 
ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE;

-- Step 2: Make staff_id nullable (since solo vendors don't have staff)
ALTER TABLE tele_queue 
ALTER COLUMN staff_id DROP NOT NULL;

-- Step 3: Add check constraint to ensure either staff_id or vendor_id is set
ALTER TABLE tele_queue 
ADD CONSTRAINT tele_queue_provider_check 
CHECK (staff_id IS NOT NULL OR vendor_id IS NOT NULL);

-- Step 4: Update unique index to handle both staff and vendors
DROP INDEX IF EXISTS unique_active_queue_entry;
CREATE UNIQUE INDEX unique_active_queue_entry ON tele_queue(customer_id, COALESCE(staff_id, vendor_id)) 
WHERE status = 'waiting';

-- Step 5: Update position index to handle vendors
DROP INDEX IF EXISTS idx_tele_queue_position;
CREATE INDEX idx_tele_queue_position ON tele_queue(COALESCE(staff_id, vendor_id), position) 
WHERE status = 'waiting';

-- Step 6: Update staff_id status index
DROP INDEX IF EXISTS idx_tele_queue_staff_id_status;
CREATE INDEX idx_tele_queue_staff_id_status ON tele_queue(COALESCE(staff_id, vendor_id), status);

-- Step 7: Add index for vendor_id lookups
CREATE INDEX IF NOT EXISTS idx_tele_queue_vendor_id ON tele_queue(vendor_id) WHERE vendor_id IS NOT NULL;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'tele_queue' 
  AND column_name IN ('staff_id', 'vendor_id')
ORDER BY column_name;
