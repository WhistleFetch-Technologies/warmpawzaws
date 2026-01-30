#!/usr/bin/env node
/**
 * Add custom_services capability to vet_solo role
 * 
 * This script adds the custom_services and custom_service permissions
 * to the vet_solo role, which already has allowCustomServicesForSolo: true
 * in its config but was missing the actual permission.
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

// Permissions to add
const PERMISSIONS_TO_ADD = [
  'custom_services',
  'custom_service',
];

// Target role
const TARGET_ROLE = 'vet_solo';

async function addCustomServicesCapability() {
  console.log('🔧 Adding custom_services capability to vet_solo role...');
  console.log('========================================\n');
  
  try {
    const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
    
    console.log(`📡 Getting database connection details for ${clusterId}...`);
    
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
    
    console.log(`   Endpoint: ${endpoint}`);
    console.log(`   Port: ${port}`);
    console.log(`   Database: ${dbName}`);
    
    // Get password from Secrets Manager
    console.log('\n🔑 Getting database credentials from Secrets Manager...');
    const secretsClient = new SecretsManagerClient({ region: REGION });
    const secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
    
    const secretValue = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );
    
    const secret = JSON.parse(secretValue.SecretString);
    const password = secret.password || secret.Password;
    
    console.log('   ✅ Credentials retrieved successfully');
    
    // Connect to database
    console.log('\n🔌 Connecting to database...');
    const pool = new Pool({
      host: endpoint,
      port: parseInt(port, 10),
      database: dbName,
      user: username,
      password: password,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });
    
    // Get the role ID
    console.log(`\n📋 Finding role: ${TARGET_ROLE}...`);
    const roleResult = await pool.query(
      `SELECT id, name, display_name, config FROM roles WHERE name = $1`,
      [TARGET_ROLE]
    );
    
    if (roleResult.rows.length === 0) {
      console.error(`❌ Role '${TARGET_ROLE}' not found!`);
      await pool.end();
      process.exit(1);
    }
    
    const role = roleResult.rows[0];
    console.log(`   ✅ Found role: ${role.display_name} (${role.id})`);
    console.log(`   Config has allowCustomServicesForSolo: ${role.config?.capabilityRules?.solo?.allowCustomServicesForSolo}`);
    
    // Check existing permissions
    console.log(`\n📝 Checking existing permissions...`);
    const existingPerms = await pool.query(
      `SELECT permission_name FROM role_permissions WHERE role_id = $1`,
      [role.id]
    );
    
    const existingPermNames = existingPerms.rows.map(r => r.permission_name);
    console.log(`   Current permissions count: ${existingPermNames.length}`);
    
    // Add each permission if not exists
    console.log(`\n➕ Adding permissions...`);
    let added = 0;
    let skipped = 0;
    
    for (const permission of PERMISSIONS_TO_ADD) {
      if (existingPermNames.includes(permission)) {
        console.log(`   ⏭️  ${permission}: Already exists, skipping`);
        skipped++;
      } else {
        // Check one more time to avoid duplicates
        const checkResult = await pool.query(
          `SELECT 1 FROM role_permissions WHERE role_id = $1 AND permission_name = $2`,
          [role.id, permission]
        );
        
        if (checkResult.rows.length === 0) {
          await pool.query(
            `INSERT INTO role_permissions (role_id, permission_name, resource, action, created_at) 
             VALUES ($1, $2, '*', '*', NOW())`,
            [role.id, permission]
          );
          console.log(`   ✅ ${permission}: Added successfully`);
          added++;
        } else {
          console.log(`   ⏭️  ${permission}: Already exists (double-check), skipping`);
          skipped++;
        }
      }
    }
    
    // Verify the changes
    console.log(`\n✅ Verifying changes...`);
    const verifyResult = await pool.query(
      `SELECT permission_name FROM role_permissions 
       WHERE role_id = $1 AND permission_name IN ($2, $3)`,
      [role.id, ...PERMISSIONS_TO_ADD]
    );
    
    console.log(`   Permissions now present: ${verifyResult.rows.map(r => r.permission_name).join(', ')}`);
    
    // Summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Role: ${TARGET_ROLE} (${role.id})`);
    console.log(`Permissions Added: ${added}`);
    console.log(`Permissions Skipped (already exist): ${skipped}`);
    console.log('═══════════════════════════════════════════════════════════════');
    
    if (added > 0) {
      console.log('\n✅ SUCCESS! custom_services capability has been added to vet_solo role.');
      console.log('   Vendors with this role should now be able to create custom services.');
    } else {
      console.log('\n✅ No changes needed - all permissions already exist.');
    }
    
    await pool.end();
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

addCustomServicesCapability();
