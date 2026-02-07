-- ============================================================================
-- FIX SPECIFIC STAFF MEMBERS' VENDOR_IDENTITY
-- ============================================================================
-- Run this to fix the two staff members mentioned:
-- - Phone: 8426334832 (Shivang Tiwari)
-- - Phone: 5555555555 (Shivang Tiwari)
-- ============================================================================

-- Step 1: Check current state
SELECT 
    s.id as staff_id,
    s.name,
    s.phone,
    s.vendor_id,
    s.role,
    vi.id as vendor_identity_id,
    vi.user_type,
    vi.onboarding_status,
    vi.vendor_id as vi_vendor_id,
    vi.selected_role_id
FROM staff s
LEFT JOIN vendor_identity vi ON s.phone = vi.phone
WHERE s.phone IN ('8426334832', '5555555555')
ORDER BY s.phone;

-- Step 2: Delete existing vendor_identity for these staff (if exists)
DELETE FROM vendor_identity
WHERE phone IN ('8426334832', '5555555555');

-- Step 3: Get role_id for "doctor" role
-- First, check what role IDs exist for "doctor"
SELECT id, name, display_name 
FROM roles 
WHERE (name = 'doctor' OR display_name = 'doctor' OR LOWER(name) = 'doctor')
  AND is_active = true;

-- Step 4: Get vendor_type from the vendor's vendor_identity
SELECT vendor_type 
FROM vendor_identity 
WHERE vendor_id = '476d61ee-aa26-4415-a1b2-e41f71bc7f29'::uuid
  AND (user_type IS NULL OR user_type = 'vendor')
LIMIT 1;

-- Step 5: Get business_name from vendors table
SELECT business_name 
FROM vendors 
WHERE id = '476d61ee-aa26-4415-a1b2-e41f71bc7f29'::uuid;

-- Step 6: Create vendor_identity for staff phone 8426334832
-- Replace ROLE_ID_HERE with the actual role ID from Step 3
-- Replace VENDOR_TYPE_HERE with the vendor_type from Step 4 (or use 'business' as default)
-- Replace BUSINESS_NAME_HERE with business_name from Step 5 (or use 'Vendor' as default)
INSERT INTO vendor_identity (
    phone,
    user_type,
    onboarding_status,
    vendor_id,
    selected_role_id,
    vendor_type,
    full_name,
    business_name,
    email,
    metadata
)
SELECT 
    s.phone,
    'staff',
    'ACTIVATED',
    s.vendor_id::uuid,
    r.id as selected_role_id,
    COALESCE(vi_vendor.vendor_type, 'business') as vendor_type,
    s.name as full_name,
    COALESCE(v.business_name, s.name) as business_name,
    s.email,
    jsonb_build_object(
        'staff_id', s.id,
        'created_via', 'staff_fix_script'
    ) as metadata
FROM staff s
LEFT JOIN roles r ON (
    r.name = s.role OR 
    r.display_name = s.role OR 
    LOWER(r.name) = LOWER(s.role) OR 
    LOWER(r.display_name) = LOWER(s.role)
) AND r.is_active = true
LEFT JOIN vendor_identity vi_vendor ON (
    vi_vendor.vendor_id = s.vendor_id::uuid 
    AND (vi_vendor.user_type IS NULL OR vi_vendor.user_type = 'vendor')
)
LEFT JOIN vendors v ON v.id = s.vendor_id::uuid
WHERE s.phone IN ('8426334832', '5555555555')
  AND s.is_active = true
ON CONFLICT (phone) DO UPDATE SET
    user_type = 'staff',
    onboarding_status = 'ACTIVATED',
    vendor_id = EXCLUDED.vendor_id,
    selected_role_id = EXCLUDED.selected_role_id,
    vendor_type = EXCLUDED.vendor_type,
    full_name = EXCLUDED.full_name,
    business_name = EXCLUDED.business_name,
    email = EXCLUDED.email,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- Step 7: Verify the fix
SELECT 
    s.id as staff_id,
    s.name,
    s.phone,
    s.vendor_id,
    vi.id as vendor_identity_id,
    vi.user_type,
    vi.onboarding_status,
    vi.vendor_id as vi_vendor_id,
    vi.selected_role_id,
    r.name as role_name,
    vi.vendor_type,
    vi.business_name
FROM staff s
INNER JOIN vendor_identity vi ON s.phone = vi.phone
LEFT JOIN roles r ON vi.selected_role_id = r.id
WHERE s.phone IN ('8426334832', '5555555555')
ORDER BY s.phone;
