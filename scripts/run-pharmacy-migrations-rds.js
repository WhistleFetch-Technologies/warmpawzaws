#!/usr/bin/env node
/**
 * Run Pharmacy UAT Migrations (047 & 051) on AWS RDS
 * Connects to RDS cluster and runs the Pharmacy role configuration migrations
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function runMigration() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Pharmacy UAT Migrations - AWS RDS                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  try {
    // Get RDS cluster info
    const { execSync } = require('child_process');
    const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;

    console.log('📊 Getting RDS cluster information...');
    const endpoint = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
      { encoding: 'utf8' }
    ).trim();

    if (!endpoint || endpoint === 'None' || endpoint === 'null') {
      console.error(`❌ ERROR: RDS cluster not found: ${clusterId}`);
      console.error(`   Make sure you're using the correct environment (${ENVIRONMENT})`);
      process.exit(1);
    }

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

    console.log('✅ RDS Cluster found:');
    console.log(`   Endpoint: ${endpoint}`);
    console.log(`   Port: ${port}`);
    console.log(`   Database: ${dbName}`);
    console.log(`   Username: ${username}`);
    console.log('');

    // Get password from Secrets Manager
    console.log('🔐 Getting database credentials from Secrets Manager...');
    const secretsClient = new SecretsManagerClient({ region: REGION });

    // Try to find the secret
    let secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
    
    try {
      const secretValue = await secretsClient.send(
        new GetSecretValueCommand({ SecretId: secretName })
      );

      const secret = JSON.parse(secretValue.SecretString);
      const password = secret.password || secret.Password || secret.secret || secret.Secret;

      if (!password) {
        console.error('❌ ERROR: Password not found in secret');
        process.exit(1);
      }

      console.log('✅ Credentials retrieved');
      console.log('');

      // Connect to database
      console.log('🔗 Connecting to database...');
      const pool = new Pool({
        host: endpoint,
        port: parseInt(port, 10),
        database: dbName,
        user: username,
        password: password,
        ssl: {
          rejectUnauthorized: false
        },
        connectionTimeoutMillis: 10000,
      });

      // Test connection
      await pool.query('SELECT 1');
      console.log('✅ Connection successful');
      console.log('');

      // Run Migration 047: Seed Roles
      console.log('📋 Running Migration 047: Seed Roles (Pharmacy capabilities)...');
      console.log('────────────────────────────────────────────────────────────');
      const migration047Path = path.join(__dirname, '..', 'db', 'migrations', '047_seed_roles.sql');
      const sql047 = fs.readFileSync(migration047Path, 'utf8');
      await pool.query(sql047);
      console.log('✅ Migration 047 completed');
      console.log('');

      // Run Migration 051: Role Permissions
      console.log('🔐 Running Migration 051: Role Permissions (Pharmacy permissions)...');
      console.log('────────────────────────────────────────────────────────────');
      const migration051Path = path.join(__dirname, '..', 'db', 'migrations', '051_seed_role_permissions.sql');
      const sql051 = fs.readFileSync(migration051Path, 'utf8');
      await pool.query(sql051);
      console.log('✅ Migration 051 completed');
      console.log('');

      // Verify Pharmacy role configuration
      console.log('🔍 Verifying Pharmacy role configuration...');
      console.log('────────────────────────────────────────────────────────────');
      
      // Check Pharmacy role exists
      const roleCheck = await pool.query(`
        SELECT id, name, display_name, 
               config->'capabilities' as capabilities_json,
               jsonb_array_length(config->'capabilities') as cap_count
        FROM roles 
        WHERE name = 'pharmacy'
      `);

      if (roleCheck.rows.length === 0) {
        console.error('❌ ERROR: Pharmacy role not found');
        await pool.end();
        process.exit(1);
      }

      const role = roleCheck.rows[0];
      console.log(`✅ Pharmacy role found: ${role.display_name}`);
      console.log(`   Role ID: ${role.id}`);
      console.log(`   Capabilities in config: ${role.cap_count}`);

      // Check permissions
      const permCheck = await pool.query(`
        SELECT COUNT(*) as count
        FROM role_permissions
        WHERE role_id = $1
      `, [role.id]);

      console.log(`   Permissions in database: ${permCheck.rows[0].count}`);
      console.log('');

      // List all capabilities
      const capabilities = role.capabilities_json || [];
      const expectedCaps = [
        'inventory_manage',
        'product_catalog',
        'orders',
        'order_dispatch',
        'order_broadcast',
        'availability_check',
        'prescription_create',
        'prescription_verification',
        'delivery',
        'expiry_management',
        'controlled_substances'
      ];

      console.log('📋 Pharmacy Capabilities:');
      expectedCaps.forEach(cap => {
        const found = capabilities.includes(cap) ? '✅' : '❌';
        console.log(`   ${found} ${cap}`);
      });
      console.log('');

      if (capabilities.length >= expectedCaps.length && permCheck.rows[0].count >= expectedCaps.length) {
        console.log('✅ SUCCESS: Pharmacy role has all required capabilities!');
        console.log('');
        console.log('Next steps:');
        console.log('  1. Clear browser cache (or use Incognito)');
        console.log('  2. Login as Pharmacy vendor (phone: 9606901516, OTP: 123456)');
        console.log('  3. Verify dashboard shows only Pharmacy-relevant features');
        console.log('  4. Test Inventory button persists after clicking');
      } else {
        console.log('⚠️  WARNING: Some capabilities may be missing');
        console.log(`   Expected: ${expectedCaps.length}, Found: ${capabilities.length}`);
      }

      await pool.end();
      console.log('');
      console.log('🎉 Migration and verification complete!');

    } catch (secretError) {
      console.error('');
      console.error('❌ ERROR: Could not retrieve credentials from Secrets Manager');
      console.error(`   Secret name: ${secretName}`);
      console.error(`   Error: ${secretError.message}`);
      console.error('');
      console.error('Troubleshooting:');
      console.error('  1. Check AWS credentials are configured');
      console.error('  2. Verify secret exists: aws secretsmanager list-secrets --region ' + REGION);
      console.error('  3. Check IAM permissions for Secrets Manager');
      process.exit(1);
    }

  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:');
    console.error(error.message);
    
    if (error.message.includes('does not exist')) {
      console.log('');
      console.log('ℹ️  Note: Some objects may already exist from a previous run.');
      console.log('   This is typically safe to ignore if using IF NOT EXISTS.');
    }
    
    process.exit(1);
  }
}

runMigration();
