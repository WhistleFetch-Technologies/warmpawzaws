-- ============================================================================
-- Migration 535: Fix Missing vendor_identity for Vendor 92124449-84c1-42ad-83ab-e6a7e0ee3744
-- ============================================================================
-- Purpose: Creates/updates the vendor_identity record for the approved vendor
--          and ensures all relationships are properly linked
-- Date: 2026-01-13
-- ============================================================================

BEGIN;

-- Variables
DO $$
DECLARE
    v_vendor_id UUID := '92124449-84c1-42ad-83ab-e6a7e0ee3744';
    v_phone TEXT := '98765 432102 ';
    v_email TEXT := 'ankit_Sharma@gmail.com';
    v_full_name TEXT := 'Dr. Ankit Sharma';
    v_business_name TEXT := 'Dr. Ankit Sharma_SOLO_VET_98765 432102 ';
    v_role_id UUID := '072548c8-84a9-4165-a9ec-0387c8c76a0e';
    v_vendor_type TEXT := 'business';
    v_application_id UUID := '92124449-84c1-42ad-83ab-e6a7e0ee3744';
    v_existing_identity_id UUID;
    v_existing_vendor_id UUID;
    v_application_vendor_identity_id UUID;
BEGIN
    RAISE NOTICE 'Starting migration for vendor: %', v_vendor_id;
    
    -- Step 1: Check if vendor_identity exists by ID
    SELECT id INTO v_existing_identity_id
    FROM vendor_identity
    WHERE id = v_vendor_id;
    
    -- Step 2: Check if vendor_identity exists by phone
    IF v_existing_identity_id IS NULL THEN
        SELECT id INTO v_existing_identity_id
        FROM vendor_identity
        WHERE phone = v_phone;
    END IF;
    
    -- Step 3: Check if vendors record exists
    SELECT id INTO v_existing_vendor_id
    FROM vendors
    WHERE id = v_vendor_id OR phone = v_phone;
    
    -- Step 4: Check application's current vendor_identity_id
    SELECT vendor_identity_id INTO v_application_vendor_identity_id
    FROM vendor_onboarding_applications
    WHERE id = v_application_id;
    
    RAISE NOTICE 'Found existing_identity_id: %, existing_vendor_id: %, application_vendor_identity_id: %', 
        v_existing_identity_id, v_existing_vendor_id, v_application_vendor_identity_id;
    
    -- Step 5: Create or update vendor_identity
    IF v_existing_identity_id IS NULL THEN
        -- Create new vendor_identity
        INSERT INTO vendor_identity (
            id,
            phone,
            email,
            full_name,
            business_name,
            selected_role_id,
            vendor_type,
            onboarding_status,
            application_id,
            vendor_id,
            user_type,
            metadata,
            created_at,
            updated_at
        ) VALUES (
            v_vendor_id,
            v_phone,
            v_email,
            v_full_name,
            v_business_name,
            v_role_id,
            v_vendor_type,
            'APPROVED',
            v_application_id,
            v_existing_vendor_id, -- Will be NULL if vendor doesn't exist yet
            'vendor',
            '{}'::jsonb,
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
            phone = EXCLUDED.phone,
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            business_name = EXCLUDED.business_name,
            selected_role_id = EXCLUDED.selected_role_id,
            vendor_type = EXCLUDED.vendor_type,
            onboarding_status = EXCLUDED.onboarding_status,
            application_id = EXCLUDED.application_id,
            vendor_id = COALESCE(EXCLUDED.vendor_id, vendor_identity.vendor_id),
            updated_at = NOW();
        
        RAISE NOTICE 'Created vendor_identity with ID: %', v_vendor_id;
        v_existing_identity_id := v_vendor_id;
    ELSE
        -- Update existing vendor_identity
        UPDATE vendor_identity
        SET
            phone = v_phone,
            email = COALESCE(v_email, vendor_identity.email),
            full_name = COALESCE(v_full_name, vendor_identity.full_name),
            business_name = COALESCE(v_business_name, vendor_identity.business_name),
            selected_role_id = COALESCE(v_role_id, vendor_identity.selected_role_id),
            vendor_type = COALESCE(v_vendor_type, vendor_identity.vendor_type),
            onboarding_status = 'APPROVED',
            application_id = COALESCE(v_application_id, vendor_identity.application_id),
            vendor_id = COALESCE(v_existing_vendor_id, vendor_identity.vendor_id),
            updated_at = NOW()
        WHERE id = v_existing_identity_id;
        
        RAISE NOTICE 'Updated vendor_identity with ID: %', v_existing_identity_id;
    END IF;
    
    -- Step 6: Ensure vendors record exists and is linked
    IF v_existing_vendor_id IS NULL THEN
        -- Create vendor record
        INSERT INTO vendors (
            id,
            phone,
            email,
            owner_name,
            business_name,
            role_id,
            vendor_type,
            status,
            is_active,
            address,
            city,
            state,
            pincode,
            onboarding_status,
            vendor_identity_id,
            created_at,
            updated_at,
            approved_at
        ) VALUES (
            v_vendor_id,
            v_phone,
            v_email,
            v_full_name,
            v_business_name,
            v_role_id,
            v_vendor_type,
            'approved',
            true,
            'mera-road indralok phase-6 start premier-2 A-wing 205',
            'mumbai',
            'Maharashtra',
            '401107',
            'APPROVED',
            v_existing_identity_id,
            NOW(),
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
            phone = EXCLUDED.phone,
            email = COALESCE(EXCLUDED.email, vendors.email),
            owner_name = COALESCE(EXCLUDED.owner_name, vendors.owner_name),
            business_name = COALESCE(EXCLUDED.business_name, vendors.business_name),
            role_id = COALESCE(EXCLUDED.role_id, vendors.role_id),
            vendor_type = COALESCE(EXCLUDED.vendor_type, vendors.vendor_type),
            status = 'approved',
            is_active = true,
            onboarding_status = 'APPROVED',
            vendor_identity_id = COALESCE(EXCLUDED.vendor_identity_id, vendors.vendor_identity_id),
            updated_at = NOW();
        
        v_existing_vendor_id := v_vendor_id;
        RAISE NOTICE 'Created vendor record with ID: %', v_existing_vendor_id;
    ELSE
        -- Update existing vendor record
        UPDATE vendors
        SET
            onboarding_status = 'APPROVED',
            vendor_identity_id = v_existing_identity_id,
            status = 'approved',
            is_active = true,
            updated_at = NOW()
        WHERE id = v_existing_vendor_id;
        
        RAISE NOTICE 'Updated vendor record with ID: %', v_existing_vendor_id;
    END IF;
    
    -- Step 7: Update vendor_identity to link vendor_id
    UPDATE vendor_identity
    SET
        vendor_id = v_existing_vendor_id,
        updated_at = NOW()
    WHERE id = v_existing_identity_id
      AND (vendor_id IS NULL OR vendor_id != v_existing_vendor_id);
    
    -- Step 8: Update application to link vendor_identity_id
    UPDATE vendor_onboarding_applications
    SET
        vendor_identity_id = v_existing_identity_id,
        status = 'APPROVED',
        updated_at = NOW()
    WHERE id = v_application_id
      AND (vendor_identity_id IS NULL OR vendor_identity_id != v_existing_identity_id);
    
    RAISE NOTICE 'Updated application % to link vendor_identity_id: %', v_application_id, v_existing_identity_id;
    
    -- Step 9: Verify the fix
    RAISE NOTICE '=== VERIFICATION ===';
    RAISE NOTICE 'vendor_identity.id: %', (SELECT id FROM vendor_identity WHERE id = v_existing_identity_id);
    RAISE NOTICE 'vendor_identity.vendor_id: %', (SELECT vendor_id FROM vendor_identity WHERE id = v_existing_identity_id);
    RAISE NOTICE 'vendor_identity.application_id: %', (SELECT application_id FROM vendor_identity WHERE id = v_existing_identity_id);
    RAISE NOTICE 'vendors.id: %', (SELECT id FROM vendors WHERE id = v_existing_vendor_id);
    RAISE NOTICE 'vendors.vendor_identity_id: %', (SELECT vendor_identity_id FROM vendors WHERE id = v_existing_vendor_id);
    RAISE NOTICE 'application.vendor_identity_id: %', (SELECT vendor_identity_id FROM vendor_onboarding_applications WHERE id = v_application_id);
    
    RAISE NOTICE 'Migration completed successfully!';
END $$;

COMMIT;

-- ============================================================================
-- END OF MIGRATION 535
-- ============================================================================
