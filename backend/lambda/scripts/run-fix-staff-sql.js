/**
 * ============================================================================
 * RUN FIX STAFF VENDOR_IDENTITY SQL SCRIPT
 * ============================================================================
 * This script executes the SQL fix for staff vendor_identity records
 * Run with: node scripts/run-fix-staff-sql.js
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

// Import the database connection
// Note: This requires the built dist folder
const { query } = require('../dist/database/rds-connection');

async function runFixScript() {
  try {
    console.log('🔧 Starting staff vendor_identity fix...\n');

    // Step 1: Add missing columns
    console.log('📊 Step 1: Adding missing columns...');
    
    await query(`
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'vendor_identity' AND column_name = 'user_type'
          ) THEN
              ALTER TABLE vendor_identity ADD COLUMN user_type VARCHAR(20) DEFAULT 'vendor';
              RAISE NOTICE 'Added user_type column';
          END IF;
      EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'Error adding user_type: %', SQLERRM;
      END $$;
    `);
    console.log('✅ Checked/added user_type column');

    await query(`
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'vendor_identity' AND column_name = 'metadata'
          ) THEN
              ALTER TABLE vendor_identity ADD COLUMN metadata JSONB DEFAULT '{}';
              RAISE NOTICE 'Added metadata column';
          END IF;
      EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'Error adding metadata: %', SQLERRM;
      END $$;
    `);
    console.log('✅ Checked/added metadata column');

    await query(`
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'vendor_identity' AND column_name = 'full_name'
          ) THEN
              ALTER TABLE vendor_identity ADD COLUMN full_name VARCHAR(255);
              RAISE NOTICE 'Added full_name column';
          END IF;
      EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'Error adding full_name: %', SQLERRM;
      END $$;
    `);
    console.log('✅ Checked/added full_name column');

    await query(`
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'vendor_identity' AND column_name = 'business_name'
          ) THEN
              ALTER TABLE vendor_identity ADD COLUMN business_name VARCHAR(255);
              RAISE NOTICE 'Added business_name column';
          END IF;
      EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'Error adding business_name: %', SQLERRM;
      END $$;
    `);
    console.log('✅ Checked/added business_name column\n');

    // Step 2: Delete existing vendor_identity for these staff
    console.log('🗑️  Step 2: Deleting existing vendor_identity records...');
    const deleteResult = await query(`
      DELETE FROM vendor_identity
      WHERE phone IN ('8426334832', '5555555555')
    `);
    console.log(`✅ Deleted ${deleteResult.rowCount || 0} existing records\n`);

    // Step 3: Create/Update vendor_identity with proper staff configuration
    console.log('✨ Step 3: Creating/updating vendor_identity records...');
    const insertResult = await query(`
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
        (r.name = s.role OR r.display_name = s.role OR 
         LOWER(r.name) = LOWER(s.role) OR LOWER(r.display_name) = LOWER(s.role))
        AND r.is_active = true
      )
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
        updated_at = NOW()
      RETURNING *
    `);
    console.log(`✅ Created/updated ${insertResult.rows.length} records\n`);

    // Step 4: Verify the fix
    console.log('✅ Step 4: Verifying the fix...');
    const verifyResult = await query(`
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
      ORDER BY s.phone
    `);
    
    console.log('Final state:');
    console.log(JSON.stringify(verifyResult.rows, null, 2));
    console.log('\n✅ Staff vendor_identity fix completed successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing staff vendor_identity:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the fix
runFixScript();
