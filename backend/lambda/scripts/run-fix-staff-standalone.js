/**
 * ============================================================================
 * RUN FIX STAFF VENDOR_IDENTITY SQL SCRIPT - STANDALONE VERSION
 * ============================================================================
 * This script executes the SQL fix for staff vendor_identity records
 * Uses pg directly without requiring dist folder
 * Run with: node scripts/run-fix-staff-standalone.js
 * ============================================================================
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local if it exists
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const pool = new Pool({
  host: process.env.DB_HOST || 'warmpawz-dev-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'warmpawz',
  user: process.env.DB_USER || 'warmpawz_admin',
  password: process.env.DB_PASSWORD || 'Warmpawz2026',
  ssl: {
    rejectUnauthorized: false
  }
});

async function query(text, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

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
    console.log('✅ Checked/added business_name column');

    // Check if vendor_id column exists (it should exist, but let's be safe)
    await query(`
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'vendor_identity' AND column_name = 'vendor_id'
          ) THEN
              ALTER TABLE vendor_identity ADD COLUMN vendor_id UUID REFERENCES vendors(id);
              RAISE NOTICE 'Added vendor_id column';
          END IF;
      EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'Error adding vendor_id: %', SQLERRM;
      END $$;
    `);
    console.log('✅ Checked/added vendor_id column\n');

    // Step 2: Fix ALL active staff members (not just specific phones)
    // Use DISTINCT ON to handle duplicate phones
    console.log('✨ Step 2: Creating/updating vendor_identity for ALL active staff members...');
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
      SELECT DISTINCT ON (s.phone)
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
      WHERE s.is_active = true
        AND s.vendor_id IS NOT NULL
      ORDER BY s.phone, s.created_at DESC
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
    console.log(`✅ Created/updated ${insertResult.rows.length} staff vendor_identity records\n`);

    // Step 3: Verify the fix for all staff
    console.log('✅ Step 3: Verifying the fix for all staff...');
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
      WHERE s.is_active = true
      ORDER BY s.phone
    `);
    
    console.log('Final state:');
    console.log(JSON.stringify(verifyResult.rows, null, 2));
    console.log('\n✅ Staff vendor_identity fix completed successfully!');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing staff vendor_identity:', error.message);
    console.error('Stack:', error.stack);
    await pool.end();
    process.exit(1);
  }
}

// Run the fix
runFixScript();
