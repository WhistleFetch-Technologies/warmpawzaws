-- ============================================================================
-- FIX STAFF VENDOR_IDENTITY RECORDS
-- ============================================================================
-- This script ensures all active staff members have proper vendor_identity
-- records with user_type='staff' and onboarding_status='ACTIVATED'
-- ============================================================================

-- Step 1: Check current state of staff and their vendor_identity
SELECT 
    s.id as staff_id,
    s.name as staff_name,
    s.phone as staff_phone,
    s.vendor_id,
    s.role as staff_role,
    vi.id as vendor_identity_id,
    vi.phone as vi_phone,
    vi.user_type,
    vi.onboarding_status,
    vi.vendor_id as vi_vendor_id,
    vi.selected_role_id
FROM staff s
LEFT JOIN vendor_identity vi ON s.phone = vi.phone
WHERE s.is_active = true
ORDER BY s.created_at DESC;

-- Step 2: Delete existing vendor_identity records for staff (if they're not properly configured)
DELETE FROM vendor_identity
WHERE phone IN (
    SELECT phone FROM staff WHERE is_active = true
)
AND (
    user_type IS NULL 
    OR user_type != 'staff' 
    OR onboarding_status != 'ACTIVATED'
    OR vendor_id IS NULL
);

-- Step 3: Create/Update vendor_identity for all active staff members
-- This uses a DO block to handle the logic
DO $$
DECLARE
    staff_record RECORD;
    role_id_val UUID;
    vendor_type_val VARCHAR(50);
    business_name_val VARCHAR(255);
BEGIN
    -- Loop through all active staff members
    FOR staff_record IN 
        SELECT s.id, s.name, s.phone, s.vendor_id, s.role, s.email
        FROM staff s
        WHERE s.is_active = true
    LOOP
        -- Resolve role_id from staff role name
        role_id_val := NULL;
        IF staff_record.role IS NOT NULL THEN
            SELECT id INTO role_id_val
            FROM roles
            WHERE (name = staff_record.role OR display_name = staff_record.role 
                   OR LOWER(name) = LOWER(staff_record.role) 
                   OR LOWER(display_name) = LOWER(staff_record.role))
              AND is_active = true
            LIMIT 1;
        END IF;
        
        -- Get vendor_type from vendor's vendor_identity (if exists)
        vendor_type_val := NULL;
        IF staff_record.vendor_id IS NOT NULL THEN
            SELECT vendor_type INTO vendor_type_val
            FROM vendor_identity
            WHERE vendor_id = staff_record.vendor_id::uuid 
              AND (user_type IS NULL OR user_type = 'vendor')
            LIMIT 1;
        END IF;
        
        -- Get business_name from vendors table
        business_name_val := NULL;
        IF staff_record.vendor_id IS NOT NULL THEN
            SELECT business_name INTO business_name_val
            FROM vendors
            WHERE id = staff_record.vendor_id::uuid
            LIMIT 1;
        END IF;
        
        -- Check if vendor_identity already exists
        IF EXISTS (SELECT 1 FROM vendor_identity WHERE phone = staff_record.phone) THEN
            -- Update existing record
            UPDATE vendor_identity
            SET 
                user_type = 'staff',
                onboarding_status = 'ACTIVATED',
                vendor_id = staff_record.vendor_id::uuid,
                selected_role_id = role_id_val,
                vendor_type = COALESCE(vendor_type_val, 'business'),
                full_name = staff_record.name,
                business_name = COALESCE(business_name_val, staff_record.name),
                metadata = jsonb_build_object(
                    'staff_id', staff_record.id,
                    'created_via', 'staff_fix_script'
                ),
                updated_at = NOW()
            WHERE phone = staff_record.phone;
            
            RAISE NOTICE 'Updated vendor_identity for staff % (phone: %)', staff_record.name, staff_record.phone;
        ELSE
            -- Insert new record
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
            VALUES (
                staff_record.phone,
                'staff',
                'ACTIVATED',
                staff_record.vendor_id::uuid,
                role_id_val,
                COALESCE(vendor_type_val, 'business'),
                staff_record.name,
                COALESCE(business_name_val, staff_record.name),
                staff_record.email,
                jsonb_build_object(
                    'staff_id', staff_record.id,
                    'created_via', 'staff_fix_script'
                )
            );
            
            RAISE NOTICE 'Created vendor_identity for staff % (phone: %)', staff_record.name, staff_record.phone;
        END IF;
    END LOOP;
END $$;

-- Step 4: Verify the fix
SELECT 
    s.id as staff_id,
    s.name as staff_name,
    s.phone as staff_phone,
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
WHERE s.is_active = true
ORDER BY s.created_at DESC;
