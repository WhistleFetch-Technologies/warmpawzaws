#!/usr/bin/env node
/**
 * Run Migration 313: Add created_by and created_by_role columns to prescriptions table if missing
 * Connects to AWS RDS and runs the migration script
 *
 * Usage:
 *   node scripts/run-migration-313-prescriptions-created-by.js [environment] [region]
 *
 * Example:
 *   node scripts/run-migration-313-prescriptions-created-by.js dev ap-south-1
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENVIRONMENT = process.argv[2] || process.env.ENVIRONMENT || 'dev';
const REGION = process.argv[3] || process.env.AWS_REGION || 'ap-south-1';

async function getRdsEndpoint() {
  try {
    // Try SSM parameters first (more reliable)
    try {
      const ssmHost = execSync(
        `aws ssm get-parameter --name "/warmpawz/${ENVIRONMENT}/db/host" --region "${REGION}" --query Parameter.Value --output text`,
        { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
      ).trim();
      
      const ssmPort = execSync(
        `aws ssm get-parameter --name "/warmpawz/${ENVIRONMENT}/db/port" --region "${REGION}" --query Parameter.Value --output text 2>$null || echo "5432"`,
        { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
      ).trim() || '5432';
      
      const ssmDbName = execSync(
        `aws ssm get-parameter --name "/warmpawz/${ENVIRONMENT}/db/name" --region "${REGION}" --query Parameter.Value --output text`,
        { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
      ).trim() || 'warmpawz';

      if (ssmHost && ssmHost !== 'None' && !ssmHost.includes('[')) {
        return { endpoint: ssmHost, port: parseInt(ssmPort, 10), dbName: ssmDbName };
      }
    } catch (e) {
      // SSM failed, try RDS API
    }

    // Try cluster first
    const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
    try {
      const clusterOutput = execSync(
        `aws rds describe-db-clusters --db-cluster-identifier "${clusterId}" --region "${REGION}" --query 'DBClusters[0].Endpoint' --output text`,
        { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
      ).trim();

      if (clusterOutput && clusterOutput !== 'None' && clusterOutput !== 'null' && !clusterOutput.includes('[')) {
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
    } catch (e) {
      /* try instance */
    }

    // Try instance
    const instanceId = `warmpawz-${ENVIRONMENT}-db`;
    const instanceOutput = execSync(
      `aws rds describe-db-instances --db-instance-identifier "${instanceId}" --region "${REGION}" --query 'DBInstances[0].Endpoint.Address' --output text`,
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
    ).trim();

    if (instanceOutput && instanceOutput !== 'None' && !instanceOutput.includes('[')) {
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
  console.log('🚀 Migration 313: Add created_by and created_by_role columns to prescriptions table');
  console.log('============================================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  try {
    console.log('📊 Getting RDS cluster/instance information...');
    const { endpoint, port, dbName } = await getRdsEndpoint();
    console.log(`✅ RDS Endpoint: ${endpoint}`);
    console.log(`✅ Port: ${port}`);
    console.log(`✅ Database: ${dbName}`);
    console.log('');

    console.log('🔐 Getting database credentials from Secrets Manager...');
    const credentials = await getDbCredentials();
    console.log(`✅ Username: ${credentials.username}`);
    console.log('');

    const migrationFile = path.join(__dirname, '..', 'db', 'migrations', '313_add_prescriptions_created_by_columns.sql');
    if (!fs.existsSync(migrationFile)) {
      throw new Error(`Migration file not found: ${migrationFile}`);
    }

    const migrationSQL = fs.readFileSync(migrationFile, 'utf-8');
    console.log(`📄 Migration file: ${migrationFile}`);
    console.log('');

    console.log('🔌 Connecting to database...');
    const pool = new Pool({
      host: endpoint,
      port: port,
      database: dbName,
      user: credentials.username,
      password: credentials.password,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
    });

    await pool.query('SELECT version()');
    console.log('✅ Connection successful');
    console.log('');

    console.log('🔍 Checking current prescriptions table structure...');
    const beforeCheckCreatedBy = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'prescriptions'
        AND column_name = 'created_by'
    `);

    const beforeCheckCreatedByRole = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'prescriptions'
        AND column_name = 'created_by_role'
    `);

    if (beforeCheckCreatedBy.rows.length > 0) {
      const col = beforeCheckCreatedBy.rows[0];
      console.log('✅ Column created_by already exists:');
      console.log(`   - Type: ${col.data_type}`);
      console.log(`   - Nullable: ${col.is_nullable}`);
    } else {
      console.log('⚠️  Column created_by does not exist - will be added by migration');
    }

    if (beforeCheckCreatedByRole.rows.length > 0) {
      const col = beforeCheckCreatedByRole.rows[0];
      console.log('✅ Column created_by_role already exists:');
      console.log(`   - Type: ${col.data_type}`);
      console.log(`   - Nullable: ${col.is_nullable}`);
      console.log(`   - Default: ${col.column_default || 'NULL'}`);
    } else {
      console.log('⚠️  Column created_by_role does not exist - will be added by migration');
    }
    console.log('');

    console.log('🚀 Executing migration...');
    console.log('─────────────────────────');

    try {
      await pool.query(migrationSQL);
      console.log('✅ Migration executed successfully');
      console.log('');
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        console.log('⚠️  Column or index already exists (safe to ignore)');
        console.log('');
      } else {
        throw err;
      }
    }

    console.log('🔍 Verifying migration...');
    const afterCheckCreatedBy = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'prescriptions'
        AND column_name = 'created_by'
    `);

    const afterCheckCreatedByRole = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'prescriptions'
        AND column_name = 'created_by_role'
    `);

    if (afterCheckCreatedBy.rows.length > 0) {
      const col = afterCheckCreatedBy.rows[0];
      console.log('✅ Column created_by exists:');
      console.log(`   - Type: ${col.data_type}`);
      console.log(`   - Nullable: ${col.is_nullable}`);
    } else {
      throw new Error('Migration verification failed: created_by column not found');
    }

    if (afterCheckCreatedByRole.rows.length > 0) {
      const col = afterCheckCreatedByRole.rows[0];
      console.log('✅ Column created_by_role exists:');
      console.log(`   - Type: ${col.data_type}`);
      console.log(`   - Nullable: ${col.is_nullable}`);
      console.log(`   - Default: ${col.column_default || 'NULL'}`);
    } else {
      throw new Error('Migration verification failed: created_by_role column not found');
    }
    console.log('');

    // Check backfill results
    const backfillCheck = await pool.query(`
      SELECT 
        COUNT(*) as total_prescriptions,
        COUNT(created_by) as with_created_by,
        COUNT(*) - COUNT(created_by) as without_created_by
      FROM prescriptions
    `);

    if (backfillCheck.rows.length > 0) {
      const stats = backfillCheck.rows[0];
      console.log('📊 Prescriptions Statistics:');
      console.log(`   - Total prescriptions: ${stats.total_prescriptions}`);
      console.log(`   - With created_by: ${stats.with_created_by}`);
      console.log(`   - Without created_by: ${stats.without_created_by}`);
    }
    console.log('');

    await pool.end();
    console.log('🎉 Migration 313 completed successfully!');
    console.log('');
    console.log('📝 Next Steps:');
    console.log('   1. Deploy the updated Lambda backend');
    console.log('   2. Test prescription creation from vendor UI');
    console.log('   3. Verify prescriptions are created with created_by and created_by_role columns');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:');
    console.error(error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

runMigration();
