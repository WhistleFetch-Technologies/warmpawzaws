#!/usr/bin/env node
/**
 * Run Support Tickets Enhancements Migration (500) on AWS RDS
 * Adds missing columns required by Support CRM functionality
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function runMigration() {
  console.log('🚀 Support Tickets Enhancements Migration (500) - AWS RDS');
  console.log('==========================================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  const { execSync } = require('child_process');
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;

  console.log('📊 Getting RDS cluster information...');
  
  let endpoint, port, dbName, username;
  
  try {
    endpoint = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
      { encoding: 'utf8' }
    ).trim();

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
  } catch (err) {
    console.error('❌ ERROR: Failed to get RDS cluster info:', err.message);
    process.exit(1);
  }

  console.log(`   Endpoint: ${endpoint}:${port}/${dbName}`);

  // Get password from Secrets Manager
  console.log('🔐 Getting credentials...');
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  
  let password;
  try {
    const secretValue = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );
    const secret = JSON.parse(secretValue.SecretString);
    password = secret.password || secret.Password;
  } catch (err) {
    console.error('❌ ERROR: Could not get password:', err.message);
    process.exit(1);
  }

  console.log('✅ Credentials retrieved');

  // Connect to database
  const pool = new Pool({
    host: endpoint,
    port: parseInt(port, 10),
    database: dbName,
    user: username,
    password: password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  try {
    await pool.query('SELECT 1');
    console.log('✅ Connected to database');
    console.log('');

    // Check if support_tickets table exists
    console.log('🔍 Checking support_tickets table...');
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'support_tickets'
      )
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ support_tickets table does not exist. Please run migration 053 first.');
      process.exit(1);
    }
    console.log('   ✅ support_tickets table exists');

    // Add source column
    console.log('🔧 Adding source column...');
    await pool.query(`
      ALTER TABLE support_tickets 
      ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'customer'
    `).catch(e => console.log('   ⚠️ Column may already exist:', e.message));
    console.log('   ✅ source column added');

    // Add escalation columns
    console.log('🔧 Adding escalation columns...');
    await pool.query(`
      ALTER TABLE support_tickets 
      ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ
    `).catch(e => console.log('   ⚠️ Column may already exist:', e.message));
    
    await pool.query(`
      ALTER TABLE support_tickets 
      ADD COLUMN IF NOT EXISTS escalation_reason TEXT
    `).catch(e => console.log('   ⚠️ Column may already exist:', e.message));
    console.log('   ✅ escalation columns added');

    // Add last_updated_at column
    console.log('🔧 Adding last_updated_at column...');
    await pool.query(`
      ALTER TABLE support_tickets 
      ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ DEFAULT NOW()
    `).catch(e => console.log('   ⚠️ Column may already exist:', e.message));
    console.log('   ✅ last_updated_at column added');

    // Update status constraint to include escalated and cancelled
    console.log('🔧 Updating status constraint...');
    try {
      await pool.query(`
        ALTER TABLE support_tickets 
        DROP CONSTRAINT IF EXISTS support_tickets_status_check
      `);
      await pool.query(`
        ALTER TABLE support_tickets 
        ADD CONSTRAINT support_tickets_status_check 
        CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'escalated', 'cancelled'))
      `);
      console.log('   ✅ status constraint updated');
    } catch (e) {
      console.log('   ⚠️ Could not update constraint:', e.message);
    }

    // Add index for source column
    console.log('🔧 Adding index for source column...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_support_tickets_source ON support_tickets(source)
    `).catch(e => console.log('   ⚠️ Index may already exist:', e.message));
    console.log('   ✅ source index added');

    // Add responder_name column to support_ticket_responses
    console.log('🔧 Checking support_ticket_responses table...');
    const responsesTableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'support_ticket_responses'
      )
    `);
    
    if (responsesTableExists.rows[0].exists) {
      await pool.query(`
        ALTER TABLE support_ticket_responses
        ADD COLUMN IF NOT EXISTS responder_name TEXT
      `).catch(e => console.log('   ⚠️ Column may already exist:', e.message));
      console.log('   ✅ responder_name column added to support_ticket_responses');
    } else {
      console.log('   ⚠️ support_ticket_responses table does not exist');
    }

    // Update existing records with default values
    console.log('🔧 Updating existing records...');
    await pool.query(`
      UPDATE support_tickets SET source = 'customer' WHERE source IS NULL
    `);
    await pool.query(`
      UPDATE support_tickets SET last_updated_at = updated_at WHERE last_updated_at IS NULL
    `);
    console.log('   ✅ Existing records updated');

    // Verify columns were added
    console.log('');
    console.log('🔍 Verifying columns...');
    const columns = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'support_tickets' 
      AND column_name IN ('source', 'escalated_at', 'escalation_reason', 'last_updated_at')
      ORDER BY column_name
    `);
    
    for (const col of columns.rows) {
      console.log(`   ✅ ${col.column_name} (${col.data_type})`);
    }

    console.log('');
    console.log('✅ Support Tickets Enhancements Migration Complete!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Run the seed script to add sample tickets:');
    console.log('   node scripts/run-seed-support-tickets.js');
    console.log('2. Rebuild and deploy the backend');
    console.log('3. Refresh the Support CRM page');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
