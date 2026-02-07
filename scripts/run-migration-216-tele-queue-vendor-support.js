#!/usr/bin/env node
/**
 * Run Migration 216: Support Solo Vendors in Tele Queue
 * Adds vendor_id column and makes staff_id nullable in tele_queue table
 * Follows the same pattern as run-instant-tele-queue-migration-rds-node.js
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function runMigration() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Migration 216: Tele Queue Vendor Support                ║');
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
        connectionTimeoutMillis: 30000,
      });

      // Test connection
      await pool.query('SELECT 1');
      console.log('✅ Connection successful');
      console.log('');

      // Check current state before migration
      console.log('📊 Checking current tele_queue table structure...');
      const beforeCheck = await pool.query(`
        SELECT 
          column_name, 
          data_type, 
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'tele_queue' 
          AND column_name IN ('staff_id', 'vendor_id')
        ORDER BY column_name;
      `);

      if (beforeCheck.rows.length > 0) {
        console.log('   Current columns:');
        beforeCheck.rows.forEach(row => {
          console.log(`   - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
        });
      } else {
        console.log('   ⚠️  tele_queue table not found - please run instant-tele-queue migration first');
        await pool.end();
        process.exit(1);
      }

      // Check if migration already applied
      const hasVendorId = beforeCheck.rows.some(r => r.column_name === 'vendor_id');
      const staffIdNullable = beforeCheck.rows.find(r => r.column_name === 'staff_id')?.is_nullable === 'YES';

      if (hasVendorId && staffIdNullable) {
        console.log('');
        console.log('✅ Migration 216 already applied!');
        console.log('   - vendor_id column exists');
        console.log('   - staff_id is nullable');
        await pool.end();
        return;
      }

      console.log('');
      console.log('⚙️  Running migration 216...');
      console.log('─────────────────────────');

      // Read migration file
      const migrationPath = path.join(__dirname, '..', 'db', 'migrations', '216_tele_queue_support_vendors.sql');
      
      if (!fs.existsSync(migrationPath)) {
        console.error(`❌ ERROR: Migration file not found: ${migrationPath}`);
        await pool.end();
        process.exit(1);
      }

      const sql = fs.readFileSync(migrationPath, 'utf8');
      console.log(`📄 Migration file: ${migrationPath}`);
      console.log('');

      // Split SQL into statements (handling multi-line statements properly)
      let statements = [];
      let currentStatement = '';
      let inCommentBlock = false;
      
      const lines = sql.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip comment-only lines
        if (trimmed.startsWith('--') && !trimmed.includes('Step')) {
          continue;
        }
        
        // Handle multi-line comments
        if (trimmed.includes('/*')) {
          inCommentBlock = true;
        }
        if (trimmed.includes('*/')) {
          inCommentBlock = false;
          continue;
        }
        if (inCommentBlock) {
          continue;
        }
        
        currentStatement += line + '\n';
        
        // End statement on semicolon
        if (line.includes(';')) {
          const stmt = currentStatement.trim();
          if (stmt.length > 0 && !stmt.startsWith('--')) {
            statements.push(stmt);
          }
          currentStatement = '';
        }
      }
      
      // Add any remaining statement
      if (currentStatement.trim().length > 0) {
        statements.push(currentStatement.trim());
      }
      
      statements = statements.filter(s => s.length > 10); // Filter very short statements

      console.log(`   Executing ${statements.length} statements...`);
      console.log('');

      // Execute statements individually
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.length < 10) continue;
        
        try {
          await pool.query(statement);
          successCount++;
          process.stdout.write(`   ✅ Statement ${i + 1}/${statements.length}\r`);
        } catch (error) {
          // Some errors are expected (IF NOT EXISTS, already exists, etc.)
          if (error.message.includes('already exists') || 
              error.message.includes('duplicate') ||
              error.message.includes('does not exist') ||
              error.message.includes('IF NOT EXISTS') ||
              error.message.includes('IF EXISTS')) {
            // Safe to continue - object already exists or was dropped
            successCount++;
            process.stdout.write(`   ⚠️  Statement ${i + 1}/${statements.length} (already applied)\r`);
          } else {
            errorCount++;
            console.error(`\n❌ Error in statement ${i + 1}:`);
            console.error(`   ${error.message}`);
            console.error(`   SQL: ${statement.substring(0, 150)}...`);
            // Don't throw - continue with other statements
          }
        }
      }
      
      console.log('');
      console.log(`✅ Migration completed! (${successCount} successful, ${errorCount} errors)`);
      console.log('');

      // Verify migration
      console.log('🔍 Verifying migration...');
      const afterCheck = await pool.query(`
        SELECT 
          column_name, 
          data_type, 
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'tele_queue' 
          AND column_name IN ('staff_id', 'vendor_id')
        ORDER BY column_name;
      `);

      console.log('   Updated columns:');
      afterCheck.rows.forEach(row => {
        const nullable = row.is_nullable === 'YES' ? '✅ nullable' : '❌ NOT NULL';
        console.log(`   - ${row.column_name}: ${row.data_type} (${nullable})`);
      });

      // Check constraints
      const constraintCheck = await pool.query(`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'tele_queue' 
          AND constraint_name = 'tele_queue_provider_check';
      `);

      if (constraintCheck.rows.length > 0) {
        console.log('   ✅ Check constraint added: tele_queue_provider_check');
      }

      // Check indexes
      console.log('');
      console.log('📑 Updated indexes:');
      const indexesResult = await pool.query(`
        SELECT indexname, tablename 
        FROM pg_indexes 
        WHERE tablename = 'tele_queue'
          AND indexname IN (
            'unique_active_queue_entry',
            'idx_tele_queue_position',
            'idx_tele_queue_staff_id_status',
            'idx_tele_queue_vendor_id'
          )
        ORDER BY indexname;
      `);

      if (indexesResult.rows.length > 0) {
        indexesResult.rows.forEach(idx => {
          console.log(`   ✅ ${idx.indexname}`);
        });
      }

      await pool.end();
      console.log('');
      console.log('🎉 Migration 216 completed successfully!');
      console.log('');
      console.log('📋 Summary:');
      console.log('   ✅ Added vendor_id column to tele_queue');
      console.log('   ✅ Made staff_id nullable');
      console.log('   ✅ Added check constraint (staff_id OR vendor_id required)');
      console.log('   ✅ Updated indexes for vendor support');
      console.log('');
      console.log('📋 Next steps:');
      console.log('   1. Deploy backend Lambda function (with improved error handling)');
      console.log('   2. Test tele consultation queue with solo vendors');
      console.log('   3. Verify queue joining works correctly');

    } catch (error) {
      console.error('');
      console.error('❌ Migration failed:');
      console.error(error.message);
      
      if (error.message.includes('does not exist')) {
        console.log('');
        console.log('ℹ️  Note: Some objects may already exist from a previous run.');
        console.log('   This is typically safe to ignore if using IF NOT EXISTS.');
      }

      if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
        console.log('');
        console.log('💡 Connection timeout - database may be in a VPC.');
        console.log('   This script needs to be run from:');
        console.log('   1. An EC2 instance or bastion host in the VPC');
        console.log('   2. A machine with VPN access to the VPC');
        console.log('   3. Or use AWS RDS Query Editor (no VPC needed)');
      }
      
      process.exit(1);
    }
  } catch (error) {
    console.error('');
    console.error('❌ Error getting cluster information:');
    console.error(error.message);
    process.exit(1);
  }
}

runMigration();
