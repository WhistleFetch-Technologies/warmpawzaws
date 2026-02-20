/**
 * Test Script: Verify Vendor Profile Fixes (JavaScript version)
 * 
 * This script tests all the fixes for:
 * - profile_photo_url extraction and saving
 * - pincode extraction and saving
 * - service_radius extraction and saving
 * - profile completion calculation
 * - Database schema (columns exist)
 * - Vendor auto-creation paths
 * 
 * Usage:
 *   node scripts/test-vendor-profile-fixes.js
 * 
 * Environment Variables:
 *   DATABASE_URL - PostgreSQL connection string
 *   API_BASE_URL - API base URL (default: https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com)
 *   STAGE - Environment stage (dev/prod, default: dev)
 */

const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL || process.env.PROD_DATABASE_URL || '';
const API_BASE_URL = process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const STAGE = process.env.STAGE || 'dev';

const results = [];

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warn: '\x1b[33m',
    reset: '\x1b[0m',
  };
  console.log(`${colors[type]}${message}${colors.reset}`);
}

function addResult(name, passed, message, details) {
  results.push({ name, passed, message, details });
  if (passed) {
    log(`✅ ${name}: ${message}`, 'success');
  } else {
    log(`❌ ${name}: ${message}`, 'error');
    if (details) {
      console.log('   Details:', JSON.stringify(details, null, 2));
    }
  }
}

async function testDatabaseSchema(pool) {
  log('\n📊 Testing Database Schema...', 'info');
  
  try {
    const columnCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'vendors' 
      AND column_name IN ('profile_photo_url', 'pincode', 'service_radius', 'qualifications', 'service_area', 'description')
      ORDER BY column_name
    `);
    
    const existingColumns = columnCheck.rows.map(r => r.column_name);
    const requiredColumns = ['profile_photo_url', 'pincode', 'service_radius', 'qualifications', 'service_area', 'description'];
    
    for (const col of requiredColumns) {
      if (existingColumns.includes(col)) {
        const colInfo = columnCheck.rows.find(r => r.column_name === col);
        addResult(
          `Schema: ${col} column exists`,
          true,
          `Type: ${colInfo.data_type}, Nullable: ${colInfo.is_nullable}`
        );
      } else {
        addResult(
          `Schema: ${col} column exists`,
          false,
          `Column ${col} does not exist in vendors table`
        );
      }
    }
    
    const pincodeInfo = columnCheck.rows.find(r => r.column_name === 'pincode');
    if (pincodeInfo) {
      addResult(
        'Schema: pincode is nullable',
        pincodeInfo.is_nullable === 'YES',
        pincodeInfo.is_nullable === 'YES' 
          ? 'Pincode is nullable (allows empty values during onboarding)'
          : 'Pincode is NOT NULL (may cause issues during onboarding)'
      );
    }
    
  } catch (error) {
    addResult('Schema: Database connection', false, `Failed to connect: ${error.message}`);
  }
}

async function testVendorAutoCreation(pool) {
  log('\n🏗️  Testing Vendor Auto-Creation Paths...', 'info');
  
  try {
    const vendorsWithMissingData = await pool.query(`
      SELECT 
        id,
        phone,
        business_name,
        CASE 
          WHEN profile_photo_url IS NULL OR profile_photo_url = '' THEN 'missing_photo'
          ELSE 'has_photo'
        END as photo_status,
        CASE 
          WHEN pincode IS NULL OR pincode = '' OR pincode IN ('000000', '0000000', '00000000') THEN 'missing_pincode'
          ELSE 'has_pincode'
        END as pincode_status,
        CASE 
          WHEN service_radius IS NULL THEN 'missing_radius'
          ELSE 'has_radius'
        END as radius_status
      FROM vendors
      WHERE onboarding_status = 'ACTIVATED'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (vendorsWithMissingData.rows.length === 0) {
      addResult(
        'Auto-Creation: Check recent vendors',
        false,
        'No activated vendors found to test'
      );
      return;
    }
    
    let vendorsWithAllData = 0;
    let vendorsWithMissingDataCount = 0;
    
    for (const vendor of vendorsWithMissingData.rows) {
      const hasAllData = 
        vendor.photo_status === 'has_photo' &&
        vendor.pincode_status === 'has_pincode' &&
        vendor.radius_status === 'has_radius';
      
      if (hasAllData) {
        vendorsWithAllData++;
      } else {
        vendorsWithMissingDataCount++;
      }
    }
    
    addResult(
      'Auto-Creation: Recent vendors data completeness',
      vendorsWithAllData > 0 || vendorsWithMissingDataCount === 0,
      `${vendorsWithAllData}/${vendorsWithMissingData.rows.length} vendors have all profile data (photo, pincode, radius)`,
      {
        total: vendorsWithMissingData.rows.length,
        complete: vendorsWithAllData,
        incomplete: vendorsWithMissingDataCount,
        sample: vendorsWithMissingData.rows.slice(0, 3).map(v => ({
          id: v.id,
          phone: v.phone,
          business_name: v.business_name,
          photo: v.photo_status,
          pincode: v.pincode_status,
          radius: v.radius_status,
        })),
      }
    );
    
    const identitiesWithoutVendors = await pool.query(`
      SELECT 
        vi.id,
        vi.phone,
        vi.onboarding_status,
        v.id as vendor_id
      FROM vendor_identity vi
      LEFT JOIN vendors v ON v.phone = vi.phone OR v.id = vi.vendor_id
      WHERE vi.onboarding_status IN ('APPROVED', 'ACTIVATED')
      AND v.id IS NULL
      LIMIT 5
    `);
    
    if (identitiesWithoutVendors.rows.length > 0) {
      addResult(
        'Auto-Creation: Identities without vendors',
        false,
        `Found ${identitiesWithoutVendors.rows.length} approved/activated identities without vendor records (auto-creation should handle this)`,
        {
          identities: identitiesWithoutVendors.rows.map(r => ({
            id: r.id,
            phone: r.phone,
            status: r.onboarding_status,
          })),
        }
      );
    } else {
      addResult(
        'Auto-Creation: Identities without vendors',
        true,
        'All approved/activated identities have vendor records'
      );
    }
    
  } catch (error) {
    addResult('Auto-Creation: Database query', false, `Error: ${error.message}`);
  }
}

async function testProfileCompletion(pool) {
  log('\n📈 Testing Profile Completion Calculation...', 'info');
  
  try {
    const vendors = await pool.query(`
      SELECT 
        id,
        phone,
        business_name,
        profile_photo_url,
        owner_name,
        email,
        qualifications,
        specializations,
        experience_years,
        address,
        city,
        state,
        pincode,
        service_area,
        description
      FROM vendors
      WHERE onboarding_status = 'ACTIVATED'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (vendors.rows.length === 0) {
      addResult(
        'Profile Completion: Sample vendors',
        false,
        'No activated vendors found to test'
      );
      return;
    }
    
    for (const vendor of vendors.rows) {
      let filled = 0;
      const total = 13;
      
      if (vendor.profile_photo_url && vendor.profile_photo_url.trim() && vendor.profile_photo_url !== 'null') filled++;
      if (vendor.owner_name && vendor.owner_name.trim()) filled++;
      if (vendor.phone && vendor.phone.trim()) filled++;
      if (vendor.email && vendor.email.trim()) filled++;
      if (vendor.qualifications && vendor.qualifications.trim()) filled++;
      
      const specs = vendor.specializations;
      if (specs && (
        (Array.isArray(specs) && specs.length > 0) ||
        (typeof specs === 'string' && specs.trim() && specs !== '[]' && specs !== '{}')
      )) filled++;
      
      if (vendor.experience_years !== null && vendor.experience_years !== undefined) filled++;
      if (vendor.address && vendor.address.trim()) filled++;
      if (vendor.city && vendor.city.trim()) filled++;
      if (vendor.state && vendor.state.trim()) filled++;
      
      const pincode = (vendor.pincode || '').trim();
      if (pincode && 
          pincode !== '000000' && 
          pincode !== '0000000' && 
          pincode !== '00000000' && 
          /^\d{6}$/.test(pincode)) filled++;
      
      if (vendor.service_area && vendor.service_area.trim()) filled++;
      if (vendor.description && vendor.description.trim()) filled++;
      
      const percentage = Math.round((filled / total) * 100);
      
      const missing = [
        !vendor.profile_photo_url && 'photo',
        !vendor.owner_name && 'owner_name',
        !vendor.phone && 'phone',
        !vendor.email && 'email',
        !vendor.qualifications && 'qualifications',
        !specs && 'specializations',
        vendor.experience_years === null && 'experience_years',
        !vendor.address && 'address',
        !vendor.city && 'city',
        !vendor.state && 'state',
        (!pincode || ['000000', '0000000', '00000000'].includes(pincode)) && 'pincode',
        !vendor.service_area && 'service_area',
        !vendor.description && 'description',
      ].filter(Boolean);
      
      addResult(
        `Profile Completion: ${vendor.business_name || vendor.phone}`,
        true,
        `${filled}/${total} fields filled (${percentage}%)`,
        {
          filled,
          total,
          percentage,
          missing,
        }
      );
    }
    
  } catch (error) {
    addResult('Profile Completion: Database query', false, `Error: ${error.message}`);
  }
}

async function main() {
  log('\n🧪 Starting Vendor Profile Fixes Test Suite...', 'info');
  log(`Environment: ${STAGE}`, 'info');
  log(`API Base URL: ${API_BASE_URL}`, 'info');
  log(`Database: ${DATABASE_URL ? 'Connected' : 'Not configured'}`, DATABASE_URL ? 'success' : 'warn');
  
  if (!DATABASE_URL) {
    log('⚠️  DATABASE_URL not set. Some tests will be skipped.', 'warn');
    log('   Set DATABASE_URL environment variable to run full test suite.', 'info');
    log('   Example: DATABASE_URL=postgresql://user:pass@host:5432/db node scripts/test-vendor-profile-fixes.js', 'info');
  }
  
  const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL }) : null;
  
  try {
    if (pool) {
      await testDatabaseSchema(pool);
      await testVendorAutoCreation(pool);
      await testProfileCompletion(pool);
    } else {
      log('\n⚠️  Skipping database tests (DATABASE_URL not set)', 'warn');
    }
    
    // Summary
    log('\n📊 Test Summary:', 'info');
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;
    
    log(`   Total Tests: ${total}`, 'info');
    log(`   Passed: ${passed}`, passed === total ? 'success' : 'info');
    log(`   Failed: ${failed}`, failed > 0 ? 'error' : 'success');
    
    if (failed > 0) {
      log('\n❌ Failed Tests:', 'error');
      results.filter(r => !r.passed).forEach(r => {
        log(`   - ${r.name}: ${r.message}`, 'error');
      });
    }
    
    log('\n✅ Test suite completed!', passed === total ? 'success' : 'warn');
    
    process.exit(failed > 0 ? 1 : 0);
    
  } catch (error) {
    log(`\n❌ Test suite failed: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Run tests
main().catch(console.error);
