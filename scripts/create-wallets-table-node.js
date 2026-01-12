#!/usr/bin/env node
/**
 * Create Wallets Table - Node.js Version
 * Creates the missing wallets table using AWS CLI to get credentials
 * Usage: node scripts/create-wallets-table-node.js [environment]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Try to load pg from db/node_modules first, then global
let Pool;
try {
  Pool = require(path.join(__dirname, '..', 'db', 'node_modules', 'pg')).Pool;
} catch (e) {
  try {
    Pool = require('pg').Pool;
  } catch (e2) {
    console.error('❌ ERROR: pg module not found. Please run: cd db && npm install');
    process.exit(1);
  }
}

const ENVIRONMENT = process.argv[2] || 'dev';
const REGION = process.argv[3] || 'ap-south-1';

console.log('🔧 Creating Wallets Table');
console.log('============================================================');
console.log(`Environment: ${ENVIRONMENT}`);
console.log(`Region: ${REGION}`);
console.log('');

// Get RDS cluster info
console.log('📊 Getting RDS cluster information...');
const RDS_CLUSTER_ID = `warmpawz-${ENVIRONMENT}-cluster`;

let RDS_ENDPOINT, RDS_SECRET_ARN;

try {
  RDS_ENDPOINT = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier "${RDS_CLUSTER_ID}" --region "${REGION}" --query 'DBClusters[0].Endpoint' --output text`,
    { encoding: 'utf-8' }
  ).trim();

  if (!RDS_ENDPOINT || RDS_ENDPOINT === 'None' || RDS_ENDPOINT === 'null') {
    throw new Error('RDS endpoint not found');
  }

  console.log(`✅ RDS Cluster found: ${RDS_ENDPOINT}`);
} catch (error) {
  console.error(`❌ ERROR: RDS cluster not found: ${RDS_CLUSTER_ID}`);
  console.error(`   ${error.message}`);
  process.exit(1);
}

// Get secret ARN
console.log('🔐 Getting database credentials from Secrets Manager...');
try {
  RDS_SECRET_ARN = execSync(
    `aws secretsmanager list-secrets --region "${REGION}" --query "SecretList[?starts_with(Name, 'warmpawz-${ENVIRONMENT}-rds-master')].ARN" --output text`,
    { encoding: 'utf-8' }
  ).trim().split('\n')[0];

  if (!RDS_SECRET_ARN || RDS_SECRET_ARN === 'None' || RDS_SECRET_ARN === 'null') {
    throw new Error('Secret ARN not found');
  }

  console.log(`✅ Secret found: ${RDS_SECRET_ARN}`);
} catch (error) {
  console.error(`❌ ERROR: RDS secret not found`);
  console.error(`   ${error.message}`);
  process.exit(1);
}

// Get credentials
let DB_SECRET;
try {
  DB_SECRET = execSync(
    `aws secretsmanager get-secret-value --secret-id "${RDS_SECRET_ARN}" --region "${REGION}" --query SecretString --output text`,
    { encoding: 'utf-8' }
  ).trim();
} catch (error) {
  console.error(`❌ ERROR: Failed to retrieve secret`);
  console.error(`   ${error.message}`);
  process.exit(1);
}

const secretData = JSON.parse(DB_SECRET);
const DB_USERNAME = secretData.username || secretData.Username || 'warmpawz_admin';
const DB_PASSWORD = secretData.password || secretData.Password || '';

if (!DB_PASSWORD) {
  console.error('❌ ERROR: Password not found in secret');
  process.exit(1);
}

// URL-encode password
const url = require('url');
const DB_PASSWORD_ENCODED = encodeURIComponent(DB_PASSWORD);

// Construct DATABASE_URL
const DATABASE_URL = `postgresql://${DB_USERNAME}:${DB_PASSWORD_ENCODED}@${RDS_ENDPOINT}:5432/warmpawz`;

console.log('🔌 Database URL constructed');
console.log('');

// Use migration file if available
const WALLET_MIGRATION_FILE = path.join(__dirname, '..', 'db', 'migrations', '012_wallet_tables.sql');
let sqlContent;

if (fs.existsSync(WALLET_MIGRATION_FILE)) {
  console.log('📝 Using migration file: 012_wallet_tables.sql');
  sqlContent = fs.readFileSync(WALLET_MIGRATION_FILE, 'utf8');
} else {
  console.log('📝 Creating wallets table SQL inline...');
  sqlContent = `
-- Customer Wallets
CREATE TABLE IF NOT EXISTS customer_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL UNIQUE REFERENCES customers(id),
    balance NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wallet Transactions
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES customer_wallets(id),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit', 'debit', 'refund', 'payout')),
    amount NUMERIC(10, 2) NOT NULL,
    balance_after NUMERIC(10, 2) NOT NULL,
    reference_type TEXT,
    reference_id UUID,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_customer_wallets_customer_id ON customer_wallets(customer_id);
  `.trim();
}

// Execute SQL
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

(async () => {
  try {
    const client = await pool.connect();
    
    // Check if tables already exist
    const walletsExists = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'customer_wallets'"
    );
    
    if (walletsExists.rows.length > 0) {
      console.log('ℹ️  Wallets table already exists - skipping creation');
      console.log('✅ Wallets table is ready!');
    } else {
      console.log('📝 Executing SQL...');
      await client.query(sqlContent);
      console.log('✅ Wallets table created successfully!');
    }
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('❌ ERROR: Failed to create wallets table');
    console.error(`   ${error.message}`);
    if (error.message.includes('already exists') || error.message.includes('duplicate') || error.message.includes('column') && error.message.includes('does not exist')) {
      console.log('ℹ️  Table structure may differ from migration. Checking existing structure...');
      // Check what exists
      try {
        const client = await pool.connect();
        const check = await client.query("SELECT table_name FROM information_schema.tables WHERE table_name IN ('customer_wallets', 'wallet_transactions')");
        if (check.rows.length > 0) {
          console.log('✅ Wallet tables exist (structure may differ)');
        }
        client.release();
      } catch (e) {
        // Ignore
      }
    } else {
      process.exit(1);
    }
    await pool.end();
  }
})();
