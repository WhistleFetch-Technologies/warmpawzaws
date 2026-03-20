-- Migration 501: Vendor Type Validation and Data Fix
-- ================================================================
-- This migration:
-- 1. Adds CHECK constraint on vendor_type column
-- 2. Fixes incorrectly typed vendors (businesses marked as solo)
-- 3. Ensures data consistency for vendor discovery filtering
-- ================================================================

-- Step 1: Add vendor_type column if not exists (with default)
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS vendor_type VARCHAR(20) DEFAULT 'business';

-- Step 2: Fix vendors with business-like names that are incorrectly marked as 'solo'
-- These should be 'business' type, not 'solo'
UPDATE vendors 
SET vendor_type = 'business'
WHERE vendor_type = 'solo'
  AND (
    LOWER(business_name) LIKE '%clinic%'
    OR LOWER(business_name) LIKE '%hospital%'
    OR LOWER(business_name) LIKE '%center%'
    OR LOWER(business_name) LIKE '%centre%'
    OR LOWER(business_name) LIKE '%salon%'
    OR LOWER(business_name) LIKE '% business%'
    OR LOWER(business_name) LIKE '%pvt%'
    OR LOWER(business_name) LIKE '%ltd%'
    OR LOWER(business_name) LIKE '%llc%'
    OR LOWER(business_name) LIKE '%inc%'
  );

-- Step 3: Ensure vendors with solo roles have vendor_type = 'solo'
-- Based on role name patterns (no vendor_configuration column)
UPDATE vendors v
SET vendor_type = 'solo'
FROM roles r
WHERE v.role_id = r.id
  AND (v.vendor_type IS NULL OR v.vendor_type = 'business')
  AND (r.name LIKE '%_solo' OR r.name LIKE '%Solo%' OR LOWER(r.name) LIKE '%solo%')
  -- But not if they have business-like names
  AND COALESCE(LOWER(v.business_name), '') NOT LIKE '%clinic%'
  AND COALESCE(LOWER(v.business_name), '') NOT LIKE '%hospital%'
  AND COALESCE(LOWER(v.business_name), '') NOT LIKE '%center%'
  AND COALESCE(LOWER(v.business_name), '') NOT LIKE '%centre%'
  AND COALESCE(LOWER(v.business_name), '') NOT LIKE '%salon%';

-- Step 4: Ensure vendors with business roles have vendor_type = 'business'
UPDATE vendors v
SET vendor_type = 'business'
FROM roles r
WHERE v.role_id = r.id
  AND (v.vendor_type IS NULL OR v.vendor_type = 'solo')
  AND (r.name LIKE '%_clinic' OR r.name LIKE '%clinic%' OR r.name LIKE '%hospital%' OR r.name LIKE '%center%');

-- Step 5: Create index on vendor_type for faster filtering
CREATE INDEX IF NOT EXISTS idx_vendors_vendor_type ON vendors(vendor_type);

-- Step 6: Create composite index for service discovery
CREATE INDEX IF NOT EXISTS idx_vendors_discovery 
ON vendors(status, is_active, vendor_type) 
WHERE status = 'approved' AND is_active = true;

-- Log the changes
DO $$
DECLARE
  solo_count INTEGER;
  business_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO solo_count FROM vendors WHERE vendor_type = 'solo';
  SELECT COUNT(*) INTO business_count FROM vendors WHERE vendor_type = 'business';
  RAISE NOTICE 'Vendor type distribution: solo=%, business=%', solo_count, business_count;
END $$;
