#!/usr/bin/env node
/**
 * Analyze all roles in the database
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function analyzeRoles() {
  console.log('🔍 Analyzing All Roles in Database...');
  console.log('========================================\n');
  
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
  
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  
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
  
  // Get all roles
  console.log('📋 ALL ROLES IN DATABASE:');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const rolesResult = await pool.query(`
    SELECT 
      r.id,
      r.name,
      r.display_name,
      r.is_active,
      r.customer_service,
      r.config->>'vendorConfiguration' AS vendor_configuration,
      r.config->'serviceStyles'->'selected' AS service_styles,
      (SELECT COUNT(*) FROM vendors v WHERE v.role_id = r.id) AS vendor_count,
      (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) AS permission_count
    FROM roles r
    ORDER BY r.is_active DESC, r.customer_service, r.name
  `);
  
  let activeCount = 0;
  let inactiveCount = 0;
  let missingCustomerService = [];
  let missingVendorConfig = [];
  let rolesWithVendors = [];
  
  for (const role of rolesResult.rows) {
    const status = role.is_active ? '✅' : '❌';
    if (role.is_active) activeCount++; else inactiveCount++;
    
    if (!role.customer_service && role.is_active) {
      missingCustomerService.push(role.name);
    }
    if (!role.vendor_configuration && role.is_active) {
      missingVendorConfig.push(role.name);
    }
    if (role.vendor_count > 0) {
      rolesWithVendors.push({ name: role.name, count: role.vendor_count, active: role.is_active });
    }
    
    console.log(`${status} ${role.name}`);
    console.log(`   Display: ${role.display_name}`);
    console.log(`   Customer Service: ${role.customer_service || 'NULL ⚠️'}`);
    console.log(`   Vendor Config: ${role.vendor_configuration || 'NULL ⚠️'}`);
    console.log(`   Vendors Using: ${role.vendor_count}`);
    console.log(`   Permissions: ${role.permission_count}`);
    console.log('');
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 SUMMARY:');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Total Roles: ${rolesResult.rows.length}`);
  console.log(`Active Roles: ${activeCount}`);
  console.log(`Inactive Roles: ${inactiveCount}`);
  console.log(`\n⚠️ Active roles missing customer_service: ${missingCustomerService.length}`);
  if (missingCustomerService.length > 0) {
    console.log(`   ${missingCustomerService.join(', ')}`);
  }
  console.log(`\n⚠️ Active roles missing vendorConfiguration: ${missingVendorConfig.length}`);
  if (missingVendorConfig.length > 0) {
    console.log(`   ${missingVendorConfig.join(', ')}`);
  }
  
  console.log('\n📋 ROLES WITH VENDORS ASSIGNED:');
  for (const r of rolesWithVendors) {
    console.log(`   ${r.active ? '✅' : '❌'} ${r.name}: ${r.count} vendors`);
  }
  
  // Check for duplicates (roles serving same customer_service)
  console.log('\n📋 CUSTOMER SERVICE MAPPING:');
  const serviceMapping = await pool.query(`
    SELECT 
      customer_service,
      array_agg(name ORDER BY name) AS roles,
      COUNT(*) AS role_count
    FROM roles
    WHERE is_active = true
    GROUP BY customer_service
    ORDER BY customer_service
  `);
  
  for (const svc of serviceMapping.rows) {
    const warning = svc.role_count > 2 ? ' ⚠️ TOO MANY' : '';
    console.log(`   ${svc.customer_service || 'NULL'}: ${svc.roles.join(', ')}${warning}`);
  }
  
  await pool.end();
  console.log('\n✅ Analysis complete!');
}

analyzeRoles().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
