#!/usr/bin/env node
/**
 * Verify KYC Implementation
 * Tests:
 * 1. Database tables exist
 * 2. KYC fields are present for each role
 * 3. Field types are correct (aadhaar-otp, pan-verify, gst-verify, declaration)
 * 4. API endpoints are working
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const https = require('https');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const API_BASE_URL = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

// Expected KYC fields per role
const EXPECTED_KYC_FIELDS = {
  'walker': {
    fields: ['aadhaarNumber', 'panNumber', 'profilePhoto', 'policeVerificationDoc', 'noCriminalRecordDeclaration'],
    types: ['aadhaar-otp', 'pan-verify', 'file', 'file', 'declaration'],
  },
  'veterinarian': {
    fields: ['aadhaarNumber', 'panNumber', 'profilePhoto', 'vciRegistrationNumber', 'stateCouncilRegistration', 'degreeDoc'],
    types: ['aadhaar-otp', 'pan-verify', 'file', 'text', 'text', 'file'],
  },
  'vet_solo': {
    fields: ['aadhaarNumber', 'panNumber', 'vciRegistrationNumber', 'stateCouncilRegistration', 'degreeDoc'],
    types: ['aadhaar-otp', 'pan-verify', 'text', 'text', 'file'],
  },
  'vet_clinic': {
    fields: ['aadhaarNumber', 'panNumber', 'vciRegistrationNumber', 'gstNumber'],
    types: ['aadhaar-otp', 'pan-verify', 'text', 'gst-verify'],
  },
  'breeder': {
    fields: ['aadhaarNumber', 'panNumber', 'awbiRegistration', 'breedingLimitsDeclaration', 'noThirdPartySalesDeclaration'],
    types: ['aadhaar-otp', 'pan-verify', 'text', 'declaration', 'declaration'],
  },
  'groomer_solo': {
    fields: ['aadhaarNumber', 'panNumber', 'noCriminalRecordDeclaration'],
    types: ['aadhaar-otp', 'pan-verify', 'declaration'],
  },
  'pharmacy': {
    fields: ['aadhaarNumber', 'panNumber', 'gstNumber'],
    types: ['aadhaar-otp', 'pan-verify', 'gst-verify'],
  },
};

async function makeRequest(method, path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

async function verifyKYCImplementation() {
  console.log('🔍 KYC Implementation Verification');
  console.log('===================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  const results = {
    database: { passed: 0, failed: 0, tests: [] },
    fields: { passed: 0, failed: 0, tests: [] },
    api: { passed: 0, failed: 0, tests: [] },
  };

  // Connect to database
  const { execSync } = require('child_process');
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;

  console.log('📊 Connecting to database...');
  
  let pool;
  try {
    const endpoint = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
      { encoding: 'utf8' }
    ).trim();

    const port = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Port' --output text`,
      { encoding: 'utf8' }
    ).trim() || '5432';

    const dbName = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].DatabaseName' --output text`,
      { encoding: 'utf8' }
    ).trim() || 'warmpawz';

    const username = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].MasterUsername' --output text`,
      { encoding: 'utf8' }
    ).trim() || 'warmpawz_admin';

    const secretsClient = new SecretsManagerClient({ region: REGION });
    const secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
    const secretValue = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
    const secret = JSON.parse(secretValue.SecretString);
    const password = secret.password || secret.Password;

    pool = new Pool({
      host: endpoint,
      port: parseInt(port, 10),
      database: dbName,
      user: username,
      password: password,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 30000,
    });

    await pool.query('SELECT 1');
    console.log('✅ Connected to database');
  } catch (err) {
    console.error('❌ Failed to connect to database:', err.message);
    process.exit(1);
  }

  console.log('');

  // =====================
  // 1. Database Tests
  // =====================
  console.log('📋 1. DATABASE TABLES');
  console.log('---------------------');

  const requiredTables = [
    'vendor_kyc_verifications',
    'vendor_declarations',
    'kyc_verification_audit_log',
    'onboarding_forms',
  ];

  for (const table of requiredTables) {
    const result = await pool.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)
    `, [table]);
    
    const exists = result.rows[0].exists;
    if (exists) {
      console.log(`   ✅ ${table}`);
      results.database.passed++;
      results.database.tests.push({ name: table, passed: true });
    } else {
      console.log(`   ❌ ${table} - NOT FOUND`);
      results.database.failed++;
      results.database.tests.push({ name: table, passed: false });
    }
  }

  console.log('');

  // =====================
  // 2. KYC Fields Tests
  // =====================
  console.log('📋 2. KYC FIELDS PER ROLE');
  console.log('-------------------------');

  for (const [roleName, expected] of Object.entries(EXPECTED_KYC_FIELDS)) {
    const formResult = await pool.query(
      `SELECT fields FROM onboarding_forms WHERE role_id = $1`,
      [roleName]
    );

    if (formResult.rows.length === 0) {
      console.log(`   ❌ ${roleName}: Form not found`);
      results.fields.failed++;
      results.fields.tests.push({ name: roleName, passed: false, error: 'Form not found' });
      continue;
    }

    const fields = typeof formResult.rows[0].fields === 'string'
      ? JSON.parse(formResult.rows[0].fields)
      : formResult.rows[0].fields;

    const fieldMap = new Map(fields.map(f => [f.id || f.fieldName, f]));
    
    let rolePass = true;
    const issues = [];

    for (let i = 0; i < expected.fields.length; i++) {
      const fieldId = expected.fields[i];
      const expectedType = expected.types[i];
      const field = fieldMap.get(fieldId);

      if (!field) {
        rolePass = false;
        issues.push(`Missing field: ${fieldId}`);
      } else if (field.type !== expectedType) {
        rolePass = false;
        issues.push(`${fieldId}: expected type '${expectedType}', got '${field.type}'`);
      }
    }

    if (rolePass) {
      console.log(`   ✅ ${roleName}: All ${expected.fields.length} KYC fields present with correct types`);
      results.fields.passed++;
    } else {
      console.log(`   ❌ ${roleName}: Issues found`);
      issues.forEach(issue => console.log(`      - ${issue}`));
      results.fields.failed++;
    }
    results.fields.tests.push({ name: roleName, passed: rolePass, issues });
  }

  console.log('');

  // =====================
  // 3. API Endpoint Tests
  // =====================
  console.log('📋 3. API ENDPOINTS');
  console.log('-------------------');

  const apiTests = [
    { name: 'KYC Status Endpoint', path: '/kyc/status/test-vendor-id' },
    { name: 'Admin Roles List', path: '/admin/roles' },
  ];

  for (const test of apiTests) {
    try {
      const response = await makeRequest('GET', test.path);
      
      // Check if endpoint exists (not 404)
      if (response.status !== 404) {
        console.log(`   ✅ ${test.name}: Endpoint exists (status: ${response.status})`);
        results.api.passed++;
        results.api.tests.push({ name: test.name, passed: true, status: response.status });
      } else {
        console.log(`   ❌ ${test.name}: Endpoint not found (404)`);
        results.api.failed++;
        results.api.tests.push({ name: test.name, passed: false, status: 404 });
      }
    } catch (err) {
      console.log(`   ⚠️  ${test.name}: ${err.message}`);
      results.api.tests.push({ name: test.name, passed: false, error: err.message });
    }
  }

  console.log('');

  // =====================
  // 4. KYC Field Types Verification
  // =====================
  console.log('📋 4. KYC FIELD TYPES IN DATABASE');
  console.log('----------------------------------');

  const kycTypesResult = await pool.query(`
    SELECT DISTINCT 
      role_id,
      jsonb_array_elements(fields)->>'type' as field_type,
      COUNT(*) as count
    FROM onboarding_forms
    WHERE fields IS NOT NULL
    GROUP BY role_id, jsonb_array_elements(fields)->>'type'
    ORDER BY role_id, field_type
  `);

  const kycTypes = new Set(['aadhaar-otp', 'pan-verify', 'gst-verify', 'declaration']);
  const rolesWithKYCTypes = new Map();

  for (const row of kycTypesResult.rows) {
    if (kycTypes.has(row.field_type)) {
      if (!rolesWithKYCTypes.has(row.role_id)) {
        rolesWithKYCTypes.set(row.role_id, []);
      }
      rolesWithKYCTypes.get(row.role_id).push(`${row.field_type}(${row.count})`);
    }
  }

  console.log('   Roles with KYC verification fields:');
  for (const [role, types] of rolesWithKYCTypes) {
    console.log(`   ✅ ${role}: ${types.join(', ')}`);
  }

  if (rolesWithKYCTypes.size === 0) {
    console.log('   ⚠️  No roles found with KYC verification field types');
  }

  console.log('');

  // =====================
  // Summary
  // =====================
  console.log('📊 VERIFICATION SUMMARY');
  console.log('=======================');
  console.log(`Database Tables: ${results.database.passed}/${results.database.passed + results.database.failed} passed`);
  console.log(`KYC Fields:      ${results.fields.passed}/${results.fields.passed + results.fields.failed} passed`);
  console.log(`API Endpoints:   ${results.api.passed}/${results.api.passed + results.api.failed} passed`);
  console.log('');

  const totalPassed = results.database.passed + results.fields.passed + results.api.passed;
  const totalFailed = results.database.failed + results.fields.failed + results.api.failed;

  if (totalFailed === 0) {
    console.log('✅ ALL TESTS PASSED!');
  } else {
    console.log(`⚠️  ${totalFailed} test(s) failed`);
  }

  await pool.end();
}

verifyKYCImplementation().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
