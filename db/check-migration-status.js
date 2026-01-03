#!/usr/bin/env node
/**
 * Check Migration Status Script
 * Verifies database schema and tables exist
 * 
 * Usage: node db/check-migration-status.js
 */

const { Pool } = require('pg');

// Database URL from environment or default
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL or SUPABASE_DB_URL environment variable is required');
  process.exit(1);
}

async function checkMigrationStatus() {
  console.log('🔍 Checking Migration Status');
  console.log('='.repeat(60));
  console.log(`🔌 Database: ${DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);
  console.log('');

  const pool = new Pool({ 
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : undefined
  });

  try {
    const client = await pool.connect();
    
    // Check tables
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    const { rows: tables } = await client.query(tablesQuery);
    console.log(`📊 Found ${tables.length} tables in database`);
    
    // Check key tables exist
    const keyTables = [
      'vendors', 'customers', 'pets', 'bookings', 
      'services', 'products', 'payments', 'wallets'
    ];
    
    const existingKeyTables = keyTables.filter(table => 
      tables.some(t => t.table_name === table)
    );
    
    console.log(`✅ Key tables present: ${existingKeyTables.length}/${keyTables.length}`);
    
    if (existingKeyTables.length < keyTables.length) {
      const missingTables = keyTables.filter(table => 
        !tables.some(t => t.table_name === table)
      );
      console.log(`⚠️  Missing tables: ${missingTables.join(', ')}`);
    }
    
    // Check foreign keys
    const fkQuery = `
      SELECT COUNT(*) as count
      FROM information_schema.table_constraints 
      WHERE constraint_type = 'FOREIGN KEY' 
        AND table_schema = 'public'
    `;
    
    const { rows: fkRows } = await client.query(fkQuery);
    console.log(`🔗 Foreign keys: ${fkRows[0].count}`);
    
    // Check indexes
    const indexQuery = `
      SELECT COUNT(*) as count
      FROM pg_indexes 
      WHERE schemaname = 'public'
    `;
    
    const { rows: indexRows } = await client.query(indexQuery);
    console.log(`📇 Indexes: ${indexRows[0].count}`);
    
    client.release();
    
    console.log('');
    console.log('✅ Migration status check complete');
    
  } catch (error) {
    console.error('');
    console.error('❌ Status check failed:');
    console.error(error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Check status
checkMigrationStatus();

