#!/usr/bin/env node
/**
 * Run Custom Service Approval Workflow Migration on AWS RDS
 * Migration 203: Adds approval workflow columns and constraints to vendor_services
 * 
 * Usage:
 *   node scripts/run-migration-203-custom-service-approval.js
 *   ENVIRONMENT=prod node scripts/run-migration-203-custom-service-approval.js
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function runMigration() {
  console.log('🚀 Custom Service Approval Workflow Migration - AWS RDS');
  console.log('=========================================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  // Get RDS cluster info
  const { execSync } = require('child_process');
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;

  console.log('📊 Getting RDS cluster information...');
  
  let endpoint, port, dbName, username;
  
  try {
    endpoint = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
      { encoding: 'utf8' }
    ).trim();

    if (!endpoint || endpoint === 'None' || endpoint === 'null') {
      throw new Error(`RDS cluster not found: ${clusterId}`);
    }

    port = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Port' --output text`,
      { encoding: 'utf8' }
    ).trim() || '5432';

    dbName = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].DatabaseName' --output text`,
      { encoding: 'utf8' }
    ).trim() || 'warmpawz';

    username = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].MasterUsername' --output text`,
      { encoding: 'utf8' }
    ).trim() || 'warmpawz_admin';
  } catch (error) {
    console.error(`❌ ERROR: Failed to get RDS cluster info: ${error.message}`);
    process.exit(1);
  }

  console.log('✅ RDS Cluster found:');
  console.log(`   Endpoint: ${endpoint}`);
  console.log(`   Port: ${port}`);
  console.log(`   Database: ${dbName}`);
  console.log(`   Username: ${username}`);
  console.log('');

  // Get password from Secrets Manager
  console.log('🔐 Getting database credentials from Secrets Manager...');
  const secretsClient = new SecretsManagerClient({ region: REGION });

  // Try multiple secret name patterns
  const secretPatterns = [
    `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`,
    `warmpawz-${ENVIRONMENT}-rds-credentials`,
    `warmpawz-${ENVIRONMENT}-db-password`,
    `warmpawz/${ENVIRONMENT}/rds`,
  ];

  let password = null;
  
  for (const secretName of secretPatterns) {
    try {
      const secretValue = await secretsClient.send(
        new GetSecretValueCommand({ SecretId: secretName })
      );
      const secret = JSON.parse(secretValue.SecretString);
      password = secret.password || secret.Password || secret.secret || secret.Secret;
      if (password) {
        console.log(`✅ Credentials retrieved from: ${secretName}`);
        break;
      }
    } catch (err) {
      // Try next pattern
    }
  }

  if (!password) {
    console.error('❌ ERROR: Could not retrieve database password from Secrets Manager');
    console.error('   Tried patterns:', secretPatterns.join(', '));
    process.exit(1);
  }

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

  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Connection successful');
    console.log('');

    // Run migration
    console.log('⚙️  Running Custom Service Approval Workflow Migration...');
    console.log('─────────────────────────────────────────────────────────');

    // Step 1: Check current constraint
    console.log('📋 Step 1: Checking existing publish_status constraint...');
    const constraintCheck = await pool.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as definition
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'vendor_services' 
      AND contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%publish_status%'
    `);

    if (constraintCheck.rows.length > 0) {
      console.log('   Found existing constraint:', constraintCheck.rows[0].conname);
      console.log('   Definition:', constraintCheck.rows[0].definition);
      
      // Drop existing constraint
      console.log('   Dropping existing constraint...');
      await pool.query(`ALTER TABLE vendor_services DROP CONSTRAINT IF EXISTS ${constraintCheck.rows[0].conname}`);
      console.log('   ✅ Constraint dropped');
    } else {
      console.log('   No existing publish_status constraint found');
    }

    // Step 2: Add new constraint with all statuses
    console.log('');
    console.log('📋 Step 2: Adding new publish_status constraint...');
    await pool.query(`
      ALTER TABLE vendor_services 
      ADD CONSTRAINT vendor_services_publish_status_check 
      CHECK (publish_status IN ('draft', 'pending_approval', 'published', 'rejected', 'auto_published'))
    `);
    console.log('   ✅ New constraint added');

    // Step 3: Add approval workflow columns
    console.log('');
    console.log('📋 Step 3: Adding approval workflow columns...');
    
    const columnsToAdd = [
      { name: 'submitted_for_approval_at', type: 'TIMESTAMPTZ', comment: 'Timestamp when service was submitted for admin approval' },
      { name: 'approved_at', type: 'TIMESTAMPTZ', comment: 'Timestamp when service was approved by admin' },
      { name: 'approved_by', type: 'TEXT', comment: 'Admin user ID who approved the service' },
      { name: 'admin_note', type: 'TEXT', comment: 'Notes from admin during approval/rejection' },
      { name: 'rejected_at', type: 'TIMESTAMPTZ', comment: 'Timestamp when service was rejected by admin' },
      { name: 'rejected_by', type: 'TEXT', comment: 'Admin user ID who rejected the service' },
      { name: 'rejection_reason', type: 'TEXT', comment: 'Reason for rejection, shown to vendor' },
      { name: 'change_requested_at', type: 'TIMESTAMPTZ', comment: 'Timestamp when changes were requested' },
      { name: 'change_requested_by', type: 'TEXT', comment: 'Admin user ID who requested changes' },
      { name: 'change_request_reason', type: 'TEXT', comment: 'Details of requested changes, shown to vendor' },
    ];

    for (const col of columnsToAdd) {
      try {
        await pool.query(`ALTER TABLE vendor_services ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
        await pool.query(`COMMENT ON COLUMN vendor_services.${col.name} IS '${col.comment}'`);
        console.log(`   ✅ Added column: ${col.name}`);
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(`   ℹ️  Column already exists: ${col.name}`);
        } else {
          throw err;
        }
      }
    }

    // Step 4: Add indexes
    console.log('');
    console.log('📋 Step 4: Adding indexes for approval workflow...');
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_vendor_services_pending_approval 
      ON vendor_services(submitted_for_approval_at) 
      WHERE publish_status = 'pending_approval' AND is_custom_service = true
    `);
    console.log('   ✅ Index created: idx_vendor_services_pending_approval');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_vendor_services_custom 
      ON vendor_services(vendor_id, is_custom_service) 
      WHERE is_custom_service = true
    `);
    console.log('   ✅ Index created: idx_vendor_services_custom');

    // Step 5: Verify migration
    console.log('');
    console.log('🔍 Step 5: Verifying migration...');
    
    const verifyColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'vendor_services' 
      AND column_name IN (
        'submitted_for_approval_at', 'approved_at', 'approved_by', 
        'rejected_at', 'rejected_by', 'rejection_reason',
        'change_requested_at', 'change_requested_by', 'change_request_reason'
      )
      ORDER BY column_name
    `);

    console.log('   ✅ Columns verified:');
    verifyColumns.rows.forEach(row => {
      console.log(`      - ${row.column_name} (${row.data_type})`);
    });

    const verifyConstraint = await pool.query(`
      SELECT pg_get_constraintdef(c.oid) as definition
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'vendor_services' 
      AND c.conname = 'vendor_services_publish_status_check'
    `);

    if (verifyConstraint.rows.length > 0) {
      console.log('   ✅ Constraint verified:', verifyConstraint.rows[0].definition);
    }

    // Step 6: Check for any existing custom services that need status update
    console.log('');
    console.log('📋 Step 6: Checking existing custom services...');
    
    const existingCustomServices = await pool.query(`
      SELECT publish_status, COUNT(*) as count
      FROM vendor_services
      WHERE is_custom_service = true
      GROUP BY publish_status
    `);

    if (existingCustomServices.rows.length > 0) {
      console.log('   Existing custom services by status:');
      existingCustomServices.rows.forEach(row => {
        console.log(`      - ${row.publish_status}: ${row.count}`);
      });
    } else {
      console.log('   No existing custom services found');
    }

    await pool.end();
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎉 Migration 203 completed successfully!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('Custom service approval workflow is now enabled:');
    console.log('  • Vendors can create services as "draft"');
    console.log('  • Submit for approval → "pending_approval"');
    console.log('  • Admin approves → "published" (visible to customers)');
    console.log('  • Admin rejects → "rejected" (vendor sees reason)');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:');
    console.error(error.message);
    
    if (error.message.includes('already exists')) {
      console.log('');
      console.log('ℹ️  Note: Some objects may already exist from a previous run.');
      console.log('   This is typically safe - the migration may have partially completed before.');
    }
    
    await pool.end();
    process.exit(1);
  }
}

runMigration();
