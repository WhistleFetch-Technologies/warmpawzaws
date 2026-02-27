-- ============================================================================
-- CREATE VET SOLO AND VET CLINIC VENDORS FROM ADMIN SIDE
-- ============================================================================
-- This script creates vendor records for veterinarian (solo) and vet_clinic
-- Run this after migrations 001, 002, 003 are complete
-- ============================================================================

-- Step 1: Get Role IDs (you'll need these for the vendor records)
-- Run this first to get the role IDs:

SELECT id, name, display_name 
FROM roles 
WHERE name IN ('veterinarian', 'vet_clinic')
ORDER BY name;

-- Step 2: Ensure vendor_type column exists (added in migration 500)
-- If you haven't run migration 500, vendor_type column might not exist
-- This will add it if missing:
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vendors' AND column_name = 'vendor_type'
    ) THEN
        ALTER TABLE vendors ADD COLUMN vendor_type VARCHAR(20) DEFAULT 'business';
    END IF;
END $$;

-- Step 3: Create Vet Solo (Veterinarian) Vendor
-- Replace the role_id with the actual UUID from Step 1

-- Example: Create a Veterinarian (Solo) vendor
INSERT INTO vendors (
    id,
    phone,
    email,
    business_name,
    owner_name,
    role_id,
    category,
    vendor_type,
    address,
    city,
    state,
    pincode,
    status,
    tier,
    commission_percentage,
    is_active,
    created_at,
    updated_at,
    approved_at
) VALUES (
    gen_random_uuid(),  -- or use a specific UUID
    '9876543210',  -- Replace with actual phone
    'vet.solo@example.com',  -- Replace with actual email
    'Dr. John Pet Clinic',  -- Business name
    'Dr. John Doe',  -- Owner name
    (SELECT id FROM roles WHERE name = 'veterinarian' LIMIT 1),  -- Role ID
    'healthcare',
    'solo',  -- Vendor type: solo for individual vet
    '123 Main Street',  -- Address
    'Mumbai',  -- City
    'Maharashtra',  -- State
    '400001',  -- Pincode
    'approved',  -- Status: approved, pending, active, etc.
    'Bronze',  -- Tier
    15.00,  -- Commission percentage
    true,  -- Is active
    NOW(),
    NOW(),
    NOW()  -- Approved at
) RETURNING id, business_name, role_id;

-- Step 4: Create Vet Clinic (Business) Vendor
INSERT INTO vendors (
    id,
    phone,
    email,
    business_name,
    owner_name,
    role_id,
    category,
    vendor_type,
    address,
    city,
    state,
    pincode,
    status,
    tier,
    commission_percentage,
    is_active,
    created_at,
    updated_at,
    approved_at
) VALUES (
    gen_random_uuid(),
    '9876543211',  -- Different phone
    'vet.clinic@example.com',
    'Paws & Claws Veterinary Clinic',  -- Clinic name
    'Dr. Jane Smith',  -- Owner/Manager name
    (SELECT id FROM roles WHERE name = 'vet_clinic' LIMIT 1),  -- Vet Clinic role
    'healthcare',
    'business',  -- Vendor type: business for clinic
    '456 Park Avenue',
    'Delhi',
    'Delhi',
    '110001',
    'approved',
    'Silver',  -- Can be Bronze, Silver, Gold, Platinum
    15.00,
    true,
    NOW(),
    NOW(),
    NOW()
) RETURNING id, business_name, role_id;

-- Step 5: Create vendor_identity records (required for authentication)
-- This links the vendor to phone-based authentication

-- For Vet Solo
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
    created_at,
    updated_at
) 
SELECT 
    v.phone,
    'vendor',
    'ACTIVATED',  -- Status: INIT, ROLE_PENDING, FORM_PENDING, UNDER_REVIEW, APPROVED, ACTIVATED
    v.id,
    v.role_id,
    v.vendor_type,
    v.owner_name,
    v.business_name,
    v.email,
    NOW(),
    NOW()
FROM vendors v
WHERE v.business_name = 'Dr. John Pet Clinic'  -- Match your vendor
ON CONFLICT (phone) DO UPDATE SET
    vendor_id = EXCLUDED.vendor_id,
    selected_role_id = EXCLUDED.selected_role_id,
    vendor_type = EXCLUDED.vendor_type,
    onboarding_status = 'ACTIVATED',
    updated_at = NOW();

-- For Vet Clinic
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
    created_at,
    updated_at
) 
SELECT 
    v.phone,
    'vendor',
    'ACTIVATED',
    v.id,
    v.role_id,
    v.vendor_type,
    v.owner_name,
    v.business_name,
    v.email,
    NOW(),
    NOW()
FROM vendors v
WHERE v.business_name = 'Paws & Claws Veterinary Clinic'
ON CONFLICT (phone) DO UPDATE SET
    vendor_id = EXCLUDED.vendor_id,
    selected_role_id = EXCLUDED.selected_role_id,
    vendor_type = EXCLUDED.vendor_type,
    onboarding_status = 'ACTIVATED',
    updated_at = NOW();

-- Step 6: Verify the vendors were created
SELECT 
    v.id,
    v.business_name,
    v.phone,
    v.email,
    v.vendor_type,
    v.status,
    r.name as role_name,
    r.display_name as role_display_name,
    vi.onboarding_status
FROM vendors v
LEFT JOIN roles r ON v.role_id = r.id
LEFT JOIN vendor_identity vi ON v.id = vi.vendor_id
WHERE r.name IN ('veterinarian', 'vet_clinic')
ORDER BY v.created_at DESC;
