#!/usr/bin/env node
/**
 * Check role configuration for vet-related roles
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function checkVetRoles() {
  console.log('🔍 Checking Vet Role Configurations...');
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
  
  // Get password from Secrets Manager
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
  
  // Query 1: Get all vet-related roles with their config
  console.log('\n📋 VET-RELATED ROLES:');
  console.log('─────────────────────────────────────────────');
  
  const rolesResult = await pool.query(`
    SELECT 
      id,
      name, 
      display_name,
      is_active,
      customer_service,
      config->>'vendorConfiguration' AS vendor_configuration,
      config->'serviceStyles'->'selected' AS service_styles,
      config->'capabilities' AS config_capabilities
    FROM roles 
    WHERE name IN ('veterinarian', 'vet_clinic', 'veterinary_clinic')
       OR name ILIKE '%vet%'
    ORDER BY name
  `);
  
  for (const role of rolesResult.rows) {
    console.log(`\n🔹 Role: ${role.name}`);
    console.log(`   ID: ${role.id}`);
    console.log(`   Display Name: ${role.display_name}`);
    console.log(`   Is Active: ${role.is_active}`);
    console.log(`   Customer Service: ${role.customer_service}`);
    console.log(`   Vendor Configuration: ${role.vendor_configuration}`);
    console.log(`   Service Styles: ${JSON.stringify(role.service_styles)}`);
    console.log(`   Config Capabilities: ${JSON.stringify(role.config_capabilities)}`);
  }
  
  // Query 2: Get role_permissions for each role
  console.log('\n📋 ROLE PERMISSIONS (Capabilities):');
  console.log('─────────────────────────────────────────────');
  
  const permsResult = await pool.query(`
    SELECT 
      r.name AS role_name,
      r.is_active,
      array_agg(rp.permission_name ORDER BY rp.permission_name) AS capabilities
    FROM roles r
    LEFT JOIN role_permissions rp ON r.id = rp.role_id
    WHERE r.name IN ('veterinarian', 'vet_clinic', 'veterinary_clinic')
       OR r.name ILIKE '%vet%'
    GROUP BY r.id, r.name, r.is_active
    ORDER BY r.name
  `);
  
  for (const perm of permsResult.rows) {
    console.log(`\n🔹 ${perm.role_name} (active: ${perm.is_active})`);
    console.log(`   Capabilities: ${perm.capabilities ? perm.capabilities.join(', ') : 'NONE'}`);
    
    // Check for staff_create specifically
    if (perm.capabilities && perm.capabilities.includes('staff_create')) {
      console.log('   ✅ Has staff_create capability');
    } else {
      console.log('   ❌ MISSING staff_create capability');
    }
  }
  
  await pool.end();
  console.log('\n✅ Check complete!');
}

checkVetRoles().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
