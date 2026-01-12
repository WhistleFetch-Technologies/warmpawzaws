#!/usr/bin/env node
/**
 * Migration Runner Script
 * Runs SQL migration files against the database
 * 
 * Usage: node db/run-migration.js <migration-file>
 * Example: node db/run-migration.js db/migrations/005_temporal_audit_fixes.sql
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database URL (from .env.local or default)
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://warmpawz:warmpawz@localhost:5432/warmpawz';

async function runMigration(migrationFile) {
  console.log('🚀 Migration Runner');
  console.log('==================');
  console.log(`📁 File: ${migrationFile}`);
  console.log(`🔌 Database: ${DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);
  console.log('');

  // Read migration file
  const filePath = path.resolve(migrationFile);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Migration file not found: ${filePath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(filePath, 'utf8');
  console.log(`📄 Read ${sql.length} bytes from migration file`);

  // Connect to database
  // Parse connection string for SSL configuration
  let connectionConfig;
  
  // If connecting to RDS (AWS), use explicit SSL config
  if (DATABASE_URL.includes('rds.amazonaws.com')) {
    // Parse URL to extract components
    const url = new URL(DATABASE_URL.replace('postgresql://', 'https://'));
    connectionConfig = {
      host: url.hostname,
      port: parseInt(url.port || '5432', 10),
      database: url.pathname.slice(1) || 'warmpawz',
      user: url.username,
      password: url.password,
      ssl: {
        rejectUnauthorized: false // RDS uses AWS-managed certificates
      }
    };
  } else {
    connectionConfig = { connectionString: DATABASE_URL };
  }
  
  const pool = new Pool(connectionConfig);

  try {
    console.log('🔗 Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Connected successfully');

    console.log('');
    console.log('⚙️  Running migration...');
    console.log('─'.repeat(50));

    // Execute migration
    await client.query(sql);

    console.log('─'.repeat(50));
    console.log('✅ Migration completed successfully!');

    // Verify tables were created
    console.log('');
    console.log('🔍 Verifying created objects...');
    
    const verifyQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('idempotency_keys', 'entity_audit_log', 'booking_status_history', 'payment_status_history')
      ORDER BY table_name
    `;
    
    const { rows } = await client.query(verifyQuery);
    
    if (rows.length > 0) {
      console.log('✅ Created tables:');
      rows.forEach(row => console.log(`   - ${row.table_name}`));
    }

    // Verify indexes
    const indexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND indexname LIKE 'idx_booking_slot%' OR indexname LIKE 'idx_idempotency%'
      ORDER BY indexname
    `;
    
    const { rows: indexes } = await client.query(indexQuery);
    
    if (indexes.length > 0) {
      console.log('✅ Created indexes:');
      indexes.forEach(idx => console.log(`   - ${idx.indexname}`));
    }

    client.release();
    
  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:');
    console.error(error.message);
    
    if (error.message.includes('already exists')) {
      console.log('');
      console.log('ℹ️  Note: Some objects may already exist from a previous run.');
      console.log('   This is typically safe to ignore if using IF NOT EXISTS.');
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Get migration file from command line arguments
const args = process.argv.slice(2);
const migrationFile = args[0] || 'db/migrations/005_temporal_audit_fixes.sql';

runMigration(migrationFile);

