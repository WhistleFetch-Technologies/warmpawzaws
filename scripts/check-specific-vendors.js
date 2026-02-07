#!/usr/bin/env node
/**
 * Check specific vendors mentioned by user
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function checkVendors() {
  console.log('🔍 Checking Specific Vendors...');
  console.log('========================================');
  
  const { execSync } = require('child_process');
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  
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
  
  console.log(`Connecting to: ${endpoint}:${port}/${dbName}`);
  
  const secretsClient = new SecretsManagerClient({ region: REGION });
  let secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  
  const secretValue = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );
  
  const secret = JSON.parse(secretValue.SecretString);
  const password = secret.password || secret.Password;
  
  const pool = new Pool({
    host: endpoint,
    port: parseInt(port, 10),
    database: dbName,
    user: username,
    password: password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  
  // Check vendors table for specific business names
  console.log('\n📋 VENDORS IN vendors TABLE:');
  console.log('─────────────────────────────────────────────');
  
  const targetNames = [
    'vet warmpawz',
    'vet warmpaz',
    'vettt',
    'vettt1',
    'vetttt1',
    'veterinary_clinic',
  ];
  const escapeLike = (value) => value.replace(/[\\\\%_]/g, '\\\\$&');
  const escapedTargets = targetNames.map(name => `%${escapeLike(name)}%`);
  const nameFilters = targetNames.map((_, idx) => `v.business_name ILIKE $${idx + 1} ESCAPE '\\'`);

  const vendorsResult = await pool.query(`
    SELECT 
      v.id,
      v.business_name,
      v.phone,
      v.status,
      v.role_id,
      r.name AS role_name,
      r.display_name AS role_display_name,
      r.is_active AS role_is_active,
      r.customer_service,
      r.config->>'vendorConfiguration' AS vendor_configuration
    FROM vendors v
    LEFT JOIN roles r ON v.role_id = r.id
    WHERE ${nameFilters.join(' OR ')}
    ORDER BY v.business_name
  `, escapedTargets);
  
  if (vendorsResult.rows.length === 0) {
    console.log('No vendors found with matching names in vendors table.');
  } else {
    for (const vendor of vendorsResult.rows) {
      console.log(`\n🔹 Vendor: ${vendor.business_name}`);
      console.log(`   ID: ${vendor.id}`);
      console.log(`   Phone: ${vendor.phone}`);
      console.log(`   Status: ${vendor.status}`);
      console.log(`   Role ID: ${vendor.role_id}`);
      console.log(`   Role Name: ${vendor.role_name}`);
      console.log(`   Role Active: ${vendor.role_is_active}`);
      console.log(`   Customer Service: ${vendor.customer_service}`);
      console.log(`   Vendor Configuration: ${vendor.vendor_configuration}`);
    }
  }
  
  // Also check vendor_identity table
  console.log('\n\n📋 VENDORS IN vendor_identity TABLE:');
  console.log('─────────────────────────────────────────────');

  const vendorIdentityColumns = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'vendor_identity'
  `);
  const identityColumnSet = new Set(vendorIdentityColumns.rows.map(row => row.column_name));
  const hasVendorId = identityColumnSet.has('vendor_id');

  const identitySelect = [
    'vi.id',
    'vi.phone',
    'vi.email',
    'vi.vendor_type',
    'vi.onboarding_status',
    'r.name AS selected_role_name',
    'r.display_name AS role_display_name',
    'r.is_active AS role_is_active',
    "r.config->>'vendorConfiguration' AS vendor_configuration",
  ];

  if (hasVendorId) {
    identitySelect.push('vi.vendor_id');
    identitySelect.push('v.business_name');
  }

  const identityJoins = [
    'FROM vendor_identity vi',
    'LEFT JOIN roles r ON vi.selected_role_id = r.id',
  ];
  if (hasVendorId) {
    identityJoins.push('LEFT JOIN vendors v ON vi.vendor_id = v.id');
  }

  const identityFilters = [
    ...targetNames.map((_, idx) => `vi.phone ILIKE $${idx + 1} ESCAPE '\\'`),
    ...targetNames.map((_, idx) => `vi.email ILIKE $${idx + 1 + targetNames.length} ESCAPE '\\'`),
  ];
  const identityParams = [
    ...escapedTargets,
    ...escapedTargets,
  ];

  if (hasVendorId) {
    identityFilters.push(...targetNames.map((_, idx) => `v.business_name ILIKE $${idx + 1 + targetNames.length * 2} ESCAPE '\\'`));
    identityParams.push(...escapedTargets);
  }

  const identityQuery = `
    SELECT 
      ${identitySelect.join(', ')}
    ${identityJoins.join('\n    ')}
    WHERE ${identityFilters.join(' OR ')}
    ORDER BY vi.created_at DESC
    LIMIT 20
  `;

  const identityResult = await pool.query(identityQuery, identityParams);
  
  if (identityResult.rows.length === 0) {
    console.log('No vendor identities found with matching criteria.');
  } else {
    for (const vi of identityResult.rows) {
      console.log(`\n🔹 Vendor Identity ID: ${vi.id}`);
      console.log(`   Phone: ${vi.phone}`);
      console.log(`   Email: ${vi.email}`);
      if (hasVendorId) {
        console.log(`   Business Name: ${vi.business_name || 'N/A'}`);
        console.log(`   Linked Vendor ID: ${vi.vendor_id || 'N/A'}`);
      }
      console.log(`   Vendor Type: ${vi.vendor_type}`);
      console.log(`   Onboarding Status: ${vi.onboarding_status}`);
      console.log(`   Selected Role: ${vi.selected_role_name}`);
      console.log(`   Role Active: ${vi.role_is_active}`);
      console.log(`   Vendor Configuration: ${vi.vendor_configuration}`);
    }
  }
  
  // Check role_permissions for veterinary_clinic specifically
  console.log('\n\n📋 DETAILED: veterinary_clinic role permissions:');
  console.log('─────────────────────────────────────────────');
  
  const vetClinicPerms = await pool.query(`
    SELECT rp.permission_name
    FROM role_permissions rp
    JOIN roles r ON rp.role_id = r.id
    WHERE r.name = 'veterinary_clinic'
    ORDER BY rp.permission_name
  `);
  
  console.log('Permissions:');
  vetClinicPerms.rows.forEach(row => console.log(`  - ${row.permission_name}`));
  
  await pool.end();
  console.log('\n✅ Check complete!');
}

checkVendors().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
