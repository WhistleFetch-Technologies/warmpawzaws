#!/usr/bin/env node
/**
 * ============================================================================
 * SERVICE CATALOG DEV vs PROD COMPARISON SCRIPT
 * ============================================================================
 * 
 * SAFE DATA SYNCHRONIZATION AUDIT
 * 
 * STRICT RULES:
 * - DO NOT directly write to production database
 * - DO NOT auto-execute any insert
 * - DO NOT modify any existing production data
 * - ONLY detect missing records
 * - Generate a safe SQL migration script for manual review
 * - Use transactions
 * - Avoid duplicates
 * - Preserve IDs exactly as in DEV
 * 
 * Date: 2026-02-16
 * ============================================================================
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEV_API_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const PROD_API_URL = 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com';
const ENDPOINT = '/admin/service-catalog';

// Optional: Provide auth token via environment variable or command line
const AUTH_TOKEN = process.env.AUTH_TOKEN || process.argv[2] || null;

// Output file
const OUTPUT_DIR = path.join(__dirname, '..', 'db', 'migrations');
const SQL_FILE = path.join(OUTPUT_DIR, `sync_service_catalog_${Date.now()}.sql`);

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Make HTTPS request
 */
function makeRequest(url, authToken = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    if (authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (e) {
            reject(new Error(`Failed to parse JSON: ${e.message}\nResponse: ${data.substring(0, 200)}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Normalize service record for comparison
 */
function normalizeService(service) {
  // Sort keys for consistent comparison
  const normalized = {};
  const keys = Object.keys(service).sort();
  
  for (const key of keys) {
    const value = service[key];
    
    // Normalize arrays
    if (Array.isArray(value)) {
      normalized[key] = [...value].sort();
    }
    // Normalize null/undefined
    else if (value === null || value === undefined) {
      normalized[key] = null;
    }
    // Normalize dates/timestamps
    else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      normalized[key] = new Date(value).toISOString();
    }
    // Preserve other values
    else {
      normalized[key] = value;
    }
  }
  
  return normalized;
}

/**
 * Extract services from API response
 */
function extractServices(response) {
  // Handle different response formats
  if (Array.isArray(response)) {
    return response;
  }
  if (response.services && Array.isArray(response.services)) {
    return response.services;
  }
  if (response.data && Array.isArray(response.data)) {
    return response.data;
  }
  if (response.success && response.services && Array.isArray(response.services)) {
    return response.services;
  }
  if (response.success && response.data && Array.isArray(response.data)) {
    return response.data;
  }
  
  console.warn('⚠️  Unexpected response format:', Object.keys(response));
  return [];
}

/**
 * Escape SQL string
 */
function escapeSqlString(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return `ARRAY[${value.map(v => escapeSqlString(v)).join(', ')}]::text[]`;
  }
  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }
  // String
  return `'${String(value).replace(/'/g, "''")}'`;
}

// ============================================================================
// MAIN COMPARISON LOGIC
// ============================================================================

async function main() {
  console.log('='.repeat(80));
  console.log('SERVICE CATALOG DEV vs PROD COMPARISON');
  console.log('='.repeat(80));
  console.log('');

  // ========================================================================
  // STEP 1: Fetch Data
  // ========================================================================
  console.log('📥 STEP 1: Fetching data from APIs...');
  console.log('');

  let devData, prodData;

  try {
    console.log(`  🔵 Fetching DEV: ${DEV_API_URL}${ENDPOINT}`);
    devData = await makeRequest(`${DEV_API_URL}${ENDPOINT}`, AUTH_TOKEN);
    console.log('  ✅ DEV data fetched');
  } catch (error) {
    console.error('  ❌ Failed to fetch DEV data:', error.message);
    if (error.message.includes('401') || error.message.includes('403')) {
      console.error('');
      console.error('  ⚠️  Authentication required. Please provide AUTH_TOKEN:');
      console.error('     export AUTH_TOKEN="your-token-here"');
      console.error('     OR');
      console.error('     node compare-service-catalog-dev-prod.js "your-token-here"');
      console.error('');
    }
    process.exit(1);
  }

  try {
    console.log(`  🟢 Fetching PROD: ${PROD_API_URL}${ENDPOINT}`);
    prodData = await makeRequest(`${PROD_API_URL}${ENDPOINT}`, AUTH_TOKEN);
    console.log('  ✅ PROD data fetched');
  } catch (error) {
    console.error('  ❌ Failed to fetch PROD data:', error.message);
    if (error.message.includes('401') || error.message.includes('403')) {
      console.error('');
      console.error('  ⚠️  Authentication required. Please provide AUTH_TOKEN:');
      console.error('     export AUTH_TOKEN="your-token-here"');
      console.error('     OR');
      console.error('     node compare-service-catalog-dev-prod.js "your-token-here"');
      console.error('');
    }
    process.exit(1);
  }

  console.log('');

  // Extract services from responses
  const devServices = extractServices(devData);
  const prodServices = extractServices(prodData);

  console.log(`  📊 DEV services count: ${devServices.length}`);
  console.log(`  📊 PROD services count: ${prodServices.length}`);
  console.log('');

  // ========================================================================
  // STEP 2: Normalize and Compare
  // ========================================================================
  console.log('🔍 STEP 2: Normalizing and comparing data...');
  console.log('');

  // Create maps by ID for quick lookup
  const devMap = new Map();
  const prodMap = new Map();

  for (const service of devServices) {
    const id = service.id || service.service_id;
    if (id) {
      devMap.set(String(id), normalizeService(service));
    }
  }

  for (const service of prodServices) {
    const id = service.id || service.service_id;
    if (id) {
      prodMap.set(String(id), normalizeService(service));
    }
  }

  // Find missing records
  const missingInProd = [];
  const mismatchedRecords = [];

  for (const [id, devService] of devMap.entries()) {
    if (!prodMap.has(id)) {
      // Find original service (not normalized) for SQL generation
      const originalService = devServices.find(s => String(s.id || s.service_id) === id);
      if (originalService) {
        missingInProd.push(originalService);
      }
    } else {
      // Check for mismatches (same ID but different data)
      const prodService = prodMap.get(id);
      const devStr = JSON.stringify(devService);
      const prodStr = JSON.stringify(prodService);
      
      if (devStr !== prodStr) {
        const originalService = devServices.find(s => String(s.id || s.service_id) === id);
        if (originalService) {
          mismatchedRecords.push({
            id,
            dev: originalService,
            prod: prodServices.find(s => String(s.id || s.service_id) === id),
          });
        }
      }
    }
  }

  console.log(`  ✅ Missing in PROD: ${missingInProd.length} records`);
  console.log(`  ⚠️  Mismatched (same ID, different data): ${mismatchedRecords.length} records`);
  console.log('');

  // ========================================================================
  // STEP 3: Validate Schema Compatibility
  // ========================================================================
  console.log('🔍 STEP 3: Validating schema compatibility...');
  console.log('');

  if (missingInProd.length === 0) {
    console.log('  ✅ No missing records. PROD is up to date.');
    console.log('');
    
    if (mismatchedRecords.length > 0) {
      console.log('  ⚠️  WARNING: Found records with same ID but different data:');
      for (const mismatch of mismatchedRecords.slice(0, 5)) {
        console.log(`     - ID: ${mismatch.id}`);
      }
      if (mismatchedRecords.length > 5) {
        console.log(`     ... and ${mismatchedRecords.length - 5} more`);
      }
      console.log('');
      console.log('  ⚠️  These will NOT be updated automatically.');
      console.log('  ⚠️  Manual review required if updates are needed.');
      console.log('');
    }
    
    console.log('✅ Comparison complete. No migration script needed.');
    return;
  }

  // Analyze column structure from first missing record
  const sampleRecord = missingInProd[0];
  const columns = Object.keys(sampleRecord).sort();
  
  console.log(`  📋 Detected columns (${columns.length}):`);
  for (const col of columns.slice(0, 10)) {
    console.log(`     - ${col}`);
  }
  if (columns.length > 10) {
    console.log(`     ... and ${columns.length - 10} more`);
  }
  console.log('');

  // ========================================================================
  // STEP 4: Generate SQL Script
  // ========================================================================
  console.log('📝 STEP 4: Generating SQL migration script...');
  console.log('');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const sqlLines = [
    '-- ============================================================================',
    '-- SERVICE CATALOG SYNC: DEV → PROD',
    '-- ============================================================================',
    `-- Generated: ${new Date().toISOString()}`,
    `-- Missing records in PROD: ${missingInProd.length}`,
    '--',
    '-- ⚠️  WARNING: REVIEW THIS SCRIPT BEFORE EXECUTION',
    '-- ⚠️  This script will INSERT missing records from DEV to PROD',
    '-- ⚠️  DO NOT execute without reviewing each INSERT statement',
    '-- ⚠️  Check foreign key dependencies before running',
    '--',
    '-- STRICT RULES:',
    '-- - Uses ON CONFLICT DO NOTHING to avoid duplicates',
    '-- - Preserves IDs exactly as in DEV',
    '-- - Wrapped in transaction for safety',
    '-- - No updates, no deletes, only inserts',
    '-- ============================================================================',
    '',
    'BEGIN;',
    '',
  ];

  // Generate INSERT statements
  for (const service of missingInProd) {
    const id = service.id || service.service_id;
    if (!id) {
      console.warn(`  ⚠️  Skipping service without ID:`, service.service_name || service.display_name);
      continue;
    }

    // Build column list (exclude id if it's auto-generated, but include if it's provided)
    // Filter out columns that don't exist in the actual table schema
    const validColumns = [
      'id', 'service_id', 'service_name', 'display_name', 'description',
      'category_id', 'category_name', 'sub_category_id', 'sub_category_name',
      'applicable_roles', 'service_style', 'base_price', 'duration_minutes',
      'status', 'publish_status', 'metadata', 'display_order',
      'created_at', 'updated_at', 'specialization_ids'
    ];
    
    const insertColumns = [];
    const insertValues = [];

    for (const col of columns) {
      // Skip columns that don't exist in the table schema
      if (!validColumns.includes(col)) {
        continue;
      }
      
      const value = service[col];
      
      // Skip undefined values
      if (value === undefined) {
        continue;
      }

      insertColumns.push(col);
      insertValues.push(escapeSqlString(value));
    }

    if (insertColumns.length === 0) {
      console.warn(`  ⚠️  Skipping service ${id}: no valid columns`);
      continue;
    }

    sqlLines.push(`-- Service: ${service.service_name || service.display_name || id}`);
    sqlLines.push(`-- ID: ${id}`);
    sqlLines.push(`INSERT INTO service_catalog (${insertColumns.join(', ')})`);
    sqlLines.push(`VALUES (${insertValues.join(', ')})`);
    sqlLines.push(`ON CONFLICT (id) DO NOTHING;`);
    sqlLines.push('');
  }

  sqlLines.push('COMMIT;');
  sqlLines.push('');
  sqlLines.push('-- ============================================================================');
  sqlLines.push('-- END OF MIGRATION');
  sqlLines.push('-- ============================================================================');

  const sqlContent = sqlLines.join('\n');

  // Write to file
  fs.writeFileSync(SQL_FILE, sqlContent, 'utf8');

  console.log(`  ✅ SQL script generated: ${SQL_FILE}`);
  console.log('');

  // ========================================================================
  // STEP 5: Output Summary
  // ========================================================================
  console.log('='.repeat(80));
  console.log('COMPARISON SUMMARY');
  console.log('='.repeat(80));
  console.log('');
  console.log(`📊 DEV records: ${devServices.length}`);
  console.log(`📊 PROD records: ${prodServices.length}`);
  console.log(`❌ Missing in PROD: ${missingInProd.length}`);
  console.log(`⚠️  Mismatched (same ID, different data): ${mismatchedRecords.length}`);
  console.log('');

  if (missingInProd.length > 0) {
    console.log('📋 Missing IDs:');
    for (const service of missingInProd.slice(0, 20)) {
      const id = service.id || service.service_id;
      const name = service.service_name || service.display_name || 'Unknown';
      console.log(`   - ${id}: ${name}`);
    }
    if (missingInProd.length > 20) {
      console.log(`   ... and ${missingInProd.length - 20} more`);
    }
    console.log('');
  }

  console.log('📝 SQL Migration Script:');
  console.log(`   ${SQL_FILE}`);
  console.log('');
  console.log('⚠️  IMPORTANT:');
  console.log('   1. Review the SQL script before execution');
  console.log('   2. Verify foreign key dependencies exist in PROD');
  console.log('   3. Test on a staging environment first if possible');
  console.log('   4. Backup PROD database before running');
  console.log('   5. Execute manually using: node scripts/run-migration-rds-node.js <filename>');
  console.log('');
  console.log('✅ Comparison complete!');
  console.log('');
}

// Run main function
main().catch((error) => {
  console.error('');
  console.error('❌ Fatal error:', error);
  console.error(error.stack);
  process.exit(1);
});
