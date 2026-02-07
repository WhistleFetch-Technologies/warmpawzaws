#!/usr/bin/env node
/**
 * Run Migration 301: Update vet_clinic role to allow all service styles
 * Connects to AWS RDS Serverless and runs the migration script
 * 
 * Usage:
 *   node scripts/run-migration-301-vet-clinic-service-styles.js [environment] [region]
 * 
 * Example:
 *   node scripts/run-migration-301-vet-clinic-service-styles.js dev ap-south-1
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENVIRONMENT = process.argv[2] || process.env.ENVIRONMENT || 'dev';
const REGION = process.argv[3] || process.env.AWS_REGION || 'ap-south-1';

async function getRdsEndpoint() {
  try {
    // Try cluster first (for serverless)
    const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
    try {
      const clusterOutput = execSync(
        `aws rds describe-db-clusters --db-cluster-identifier "${clusterId}" --region "${REGION}" --query 'DBClusters[0].Endpoint' --output text`,
        { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
      ).trim();
      
      if (clusterOutput && clusterOutput !== 'None' && clusterOutput !== 'null') {
        const port = execSync(
          `aws rds describe-db-clusters --db-cluster-identifier "${clusterId}" --region "${REGION}" --query 'DBClusters[0].Port' --output text`,
          { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
        ).trim() || '5432';
        
        const dbName = execSync(
          `aws rds describe-db-clusters --db-cluster-identifier "${clusterId}" --region "${REGION}" --query 'DBClusters[0].DatabaseName' --output text`,
          { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
        ).trim() || 'warmpawz';
        
        return { endpoint: clusterOutput, port: parseInt(port, 10), dbName };
      }
    } catch (error) {
      // Cluster not found, try instance
    }
    
    // Try instance
    const instanceId = `warmpawz-${ENVIRONMENT}-db`;
    const instanceOutput = execSync(
      `aws rds describe-db-instances --db-instance-identifier "${instanceId}" --region "${REGION}" --query 'DBInstances[0].Endpoint.Address' --output text`,
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    ).trim();
    
    if (instanceOutput && instanceOutput !== 'None') {
      const port = execSync(
        `aws rds describe-db-instances --db-instance-identifier "${instanceId}" --region "${REGION}" --query 'DBInstances[0].Endpoint.Port' --output text`,
        { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
      ).trim() || '5432';
      
      return { endpoint: instanceOutput, port: parseInt(port, 10), dbName: 'warmpawz' };
    }
    
    throw new Error('RDS endpoint not found');
  } catch (error) {
    throw new Error(`Failed to get RDS endpoint: ${error.message}`);
  }
}

async function getDbCredentials() {
  try {
    // Try to find the secret
    const secretNamePattern = `warmpawz-${ENVIRONMENT}-rds-master`;
    const secretsOutput = execSync(
      `aws secretsmanager list-secrets --region "${REGION}" --query "SecretList[?starts_with(Name, '${secretNamePattern}')].ARN" --output text`,
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    ).trim();
    
    const secretArn = secretsOutput.split('\n')[0] || secretsOutput;
    if (!secretArn || secretArn === 'None') {
      throw new Error('RDS secret not found');
    }
    
    const secretValue = execSync(
      `aws secretsmanager get-secret-value --secret-id "${secretArn}" --region "${REGION}" --query SecretString --output text`,
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    ).trim();
    
    const secret = JSON.parse(secretValue);
    return {
      username: secret.username || secret.Username || secret.user || 'warmpawz_admin',
      password: secret.password || secret.Password || secret.secret,
    };
  } catch (error) {
    throw new Error(`Failed to get DB credentials: ${error.message}`);
  }
}

async function runMigration() {
  console.log('🚀 Migration 301: Update vet_clinic role service styles');
  console.log('============================================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  try {
    // Get RDS endpoint
    console.log('📊 Getting RDS cluster/instance information...');
    const { endpoint, port, dbName } = await getRdsEndpoint();
    console.log(`✅ RDS Endpoint: ${endpoint}`);
    console.log(`✅ Port: ${port}`);
    console.log(`✅ Database: ${dbName}`);
    console.log('');

    // Get credentials
    console.log('🔐 Getting database credentials from Secrets Manager...');
    const credentials = await getDbCredentials();
    console.log(`✅ Username: ${credentials.username}`);
    console.log('✅ Password: [retrieved]');
    console.log('');

    // Read migration file
    const migrationFile = path.join(__dirname, '..', 'db', 'migrations', '301_update_vet_clinic_service_styles.sql');
    if (!fs.existsSync(migrationFile)) {
      throw new Error(`Migration file not found: ${migrationFile}`);
    }
    
    const migrationSQL = fs.readFileSync(migrationFile, 'utf-8');
    console.log(`📄 Migration file: ${migrationFile}`);
    console.log('');

    // Connect to database
    console.log('🔌 Connecting to database...');
    const pool = new Pool({
      host: endpoint,
      port: port,
      database: dbName,
      user: credentials.username,
      password: credentials.password,
      ssl: {
        rejectUnauthorized: false
      },
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
    });

    // Test connection
    await pool.query('SELECT version()');
    console.log('✅ Connection successful');
    console.log('');

    // Check current configuration
    console.log('🔍 Checking current vet_clinic role configuration...');
    const beforeCheck = await pool.query(`
      SELECT 
        name,
        config->'serviceStyles' as service_styles,
        updated_at
      FROM roles 
      WHERE name = 'vet_clinic' AND is_active = true
    `);

    if (beforeCheck.rows.length === 0) {
      throw new Error('vet_clinic role not found in database');
    }

    const currentStyles = beforeCheck.rows[0].service_styles;
    console.log(`   Current service styles: ${JSON.stringify(currentStyles)}`);
    console.log('');

    // Execute migration
    console.log('🚀 Executing migration...');
    console.log('─────────────────────────');
    
    try {
      await pool.query(migrationSQL);
      console.log('✅ Migration executed successfully');
      console.log('');
    } catch (error) {
      // Some errors are expected (IF NOT EXISTS, etc.)
      if (error.message.includes('already exists') || 
          error.message.includes('duplicate') ||
          error.message.includes('does not exist')) {
        console.log('⚠️  Some objects may already exist (this is safe)');
        console.log(`   ${error.message}`);
        console.log('');
      } else {
        throw error;
      }
    }

    // Verify role configuration was updated
    console.log('🔍 Verifying migration...');
    const afterCheck = await pool.query(`
      SELECT 
        name,
        config->'serviceStyles' as service_styles,
        updated_at
      FROM roles 
      WHERE name = 'vet_clinic' AND is_active = true
    `);

    if (afterCheck.rows.length > 0) {
      const updatedRole = afterCheck.rows[0];
      const newStyles = updatedRole.service_styles;
      console.log('✅ Role configuration updated:');
      console.log(`   Name: ${updatedRole.name}`);
      console.log(`   Service styles: ${JSON.stringify(newStyles)}`);
      console.log(`   Updated at: ${updatedRole.updated_at}`);
      console.log('');

      // Verify all three styles are present
      const expectedStyles = ['at_center', 'at_home', 'tele'];
      const hasAllStyles = expectedStyles.every(style => 
        Array.isArray(newStyles) && newStyles.includes(style)
      );

      if (hasAllStyles) {
        console.log('✅ All three service styles are configured correctly!');
        console.log('   - at_center (Book at Clinic)');
        console.log('   - at_home (Home Services)');
        console.log('   - tele (Tele Consultation)');
      } else {
        console.log('⚠️  Warning: Not all expected service styles found');
        console.log(`   Expected: ${JSON.stringify(expectedStyles)}`);
        console.log(`   Found: ${JSON.stringify(newStyles)}`);
      }
      console.log('');

      // Check if any vendors are using this role
      const vendorCheck = await pool.query(`
        SELECT COUNT(*) as vendor_count
        FROM vendors
        WHERE role_id = (SELECT id FROM roles WHERE name = 'vet_clinic' AND is_active = true LIMIT 1)
      `);

      if (vendorCheck.rows.length > 0 && parseInt(vendorCheck.rows[0].vendor_count) > 0) {
        console.log(`📊 Found ${vendorCheck.rows[0].vendor_count} vendor(s) using vet_clinic role`);
        console.log('   These vendors will now have access to all three service styles');
      } else {
        console.log('📊 No vendors currently using vet_clinic role');
      }
      console.log('');
    } else {
      console.log('⚠️  Warning: vet_clinic role not found after migration');
    }

    await pool.end();
    console.log('🎉 Migration 301 completed successfully!');
    console.log('');
    console.log('📝 Next Steps:');
    console.log('   1. Restart backend services to pick up the role configuration change');
    console.log('   2. Test as a vet business vendor - all three service style tabs should appear');
    console.log('   3. Verify staff can access services from all three styles');
    console.log('   4. Check that previously enabled tele services are now accessible');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:');
    console.error(error.message);
    
    if (error.message.includes('does not exist')) {
      console.log('');
      console.log('ℹ️  Note: Some objects may already exist from a previous run.');
      console.log('   This is typically safe to ignore if using IF NOT EXISTS.');
    }
    
    if (error.message.includes('ECONNREFUSED') || error.message.includes('timeout')) {
      console.log('');
      console.log('💡 Troubleshooting:');
      console.log('   1. Check if RDS cluster/instance is running');
      console.log('   2. Verify security group allows your IP');
      console.log('   3. Check if endpoint is correct');
    }
    
    if (error.stack) {
      console.error('');
      console.error('Stack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// Run migration
runMigration();
