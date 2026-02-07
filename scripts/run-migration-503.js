#!/usr/bin/env node

/**
 * Run Migration 503: Add Diagnostic Tests Columns
 * 
 * Usage:
 *   node scripts/run-migration-503.js
 *   
 * Environment:
 *   DATABASE_URL - PostgreSQL connection string
 *   
 * Or provide connection details via args:
 *   node scripts/run-migration-503.js --host=localhost --port=5432 --database=warmpawz --user=warmpawz --password=warmpawz
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = {};
process.argv.slice(2).forEach(arg => {
  if (arg.startsWith('--')) {
    const [key, value] = arg.substring(2).split('=');
    args[key] = value;
  }
});

// Get database URL from environment or args
let connectionConfig;

if (process.env.DATABASE_URL) {
  console.log('📦 Using DATABASE_URL from environment');
  connectionConfig = { connectionString: process.env.DATABASE_URL };
} else if (args.host) {
  console.log('📦 Using connection details from arguments');
  connectionConfig = {
    host: args.host,
    port: parseInt(args.port || '5432'),
    database: args.database,
    user: args.user,
    password: args.password,
  };
} else {
  // Try to load from .env.local
  try {
    const envPath = path.join(__dirname, '..', '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const dbUrl = envContent.match(/DATABASE_URL=(.+)/);
    if (dbUrl) {
      console.log('📦 Using DATABASE_URL from .env.local');
      connectionConfig = { connectionString: dbUrl[1].trim() };
    }
  } catch (e) {
    // Ignore
  }
  
  if (!connectionConfig) {
    console.error('❌ No database connection configured');
    console.error('   Set DATABASE_URL environment variable or use --host, --database, --user, --password args');
    process.exit(1);
  }
}

// Migration file path
const migrationFile = path.join(__dirname, '..', 'db', 'migrations', '503_add_diagnostic_tests_columns.sql');

async function runMigration() {
  console.log('');
  console.log('=========================================');
  console.log('Migration 503: Add Diagnostic Tests Columns');
  console.log('=========================================');
  console.log('');
  
  // Check migration file exists
  if (!fs.existsSync(migrationFile)) {
    console.error('❌ Migration file not found:', migrationFile);
    process.exit(1);
  }
  console.log('✅ Migration file found:', migrationFile);
  
  // Read migration SQL
  const migrationSQL = fs.readFileSync(migrationFile, 'utf8');
  console.log('');
  
  // Create connection pool
  const pool = new Pool(connectionConfig);
  
  try {
    // Test connection
    console.log('🔗 Connecting to database...');
    const client = await pool.connect();
    
    const versionResult = await client.query('SELECT version()');
    console.log('✅ Connected:', versionResult.rows[0].version.substring(0, 60) + '...');
    console.log('');
    
    // Check current state
    console.log('📊 Checking diagnostic_tests table structure BEFORE migration...');
    const beforeResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'diagnostic_tests'
      ORDER BY ordinal_position
    `);
    
    if (beforeResult.rows.length === 0) {
      console.log('   Table does not exist yet (will be created by migration)');
    } else {
      console.log('   Current columns:', beforeResult.rows.map(r => r.column_name).join(', '));
      const hasTestCode = beforeResult.rows.some(r => r.column_name === 'test_code');
      console.log('   test_code column exists:', hasTestCode ? 'YES' : 'NO');
    }
    console.log('');
    
    // Run migration
    console.log('🔄 Running migration...');
    console.log('');
    
    try {
      await client.query(migrationSQL);
      console.log('✅ Migration executed successfully!');
    } catch (err) {
      console.error('❌ Migration error:', err.message);
      client.release();
      await pool.end();
      process.exit(1);
    }
    
    console.log('');
    
    // Verify results
    console.log('📊 Verifying diagnostic_tests table structure AFTER migration...');
    const afterResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'diagnostic_tests'
      ORDER BY ordinal_position
    `);
    
    console.log('');
    console.log('Column Name              | Data Type        | Nullable | Default');
    console.log('-------------------------|------------------|----------|--------');
    afterResult.rows.forEach(row => {
      const name = row.column_name.padEnd(24);
      const type = row.data_type.padEnd(16);
      const nullable = row.is_nullable.padEnd(8);
      const def = (row.column_default || '').substring(0, 20);
      console.log(`${name} | ${type} | ${nullable} | ${def}`);
    });
    console.log('');
    
    // Check for test_code specifically
    const hasTestCode = afterResult.rows.some(r => r.column_name === 'test_code');
    if (hasTestCode) {
      console.log('✅ test_code column verified!');
    } else {
      console.log('❌ test_code column NOT found');
    }
    
    // Check for other new columns
    const newColumns = ['is_free_home_collection', 'home_collection_fee', 'terms_conditions', 
                        'turnaround_time_hours', 'is_package_available', 'package_price', 'package_test_count'];
    const foundNewColumns = newColumns.filter(col => afterResult.rows.some(r => r.column_name === col));
    console.log(`✅ Found ${foundNewColumns.length}/${newColumns.length} additional columns`);
    
    client.release();
    await pool.end();
    
    console.log('');
    console.log('=========================================');
    console.log('🎉 Migration 503 Complete!');
    console.log('=========================================');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Deploy backend: cd backend/lambda && npm run build');
    console.log('  2. Or push to GitHub to trigger CI/CD');
    console.log('');
    
  } catch (err) {
    console.error('❌ Connection error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
