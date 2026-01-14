#!/usr/bin/env node

/**
 * Apply Events Schema Enhancement Migration (064)
 * Uses pg from backend/lambda/node_modules
 */

const fs = require('fs');
const path = require('path');

// Use pg from backend/lambda
const pgPath = path.join(__dirname, '..', 'backend', 'lambda', 'node_modules', 'pg');
const { Pool } = require(pgPath);

// Database credentials
const DB_HOST = process.env.DB_HOST || 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_NAME = process.env.DB_NAME || 'warmpawz';
const DB_USER = process.env.DB_USER || 'warmpawz_admin';
const DB_PASSWORD = process.env.DB_PASSWORD || 'Warmpawz2026';

async function runMigration() {
  console.log('=========================================');
  console.log('Applying Events Schema Enhancement Migration');
  console.log('=========================================');
  console.log(`Host: ${DB_HOST}`);
  console.log(`Database: ${DB_NAME}`);
  console.log(`User: ${DB_USER}`);
  console.log('');

  const pool = new Pool({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    ssl: false,
  });

  try {
    // Test connection
    console.log('Testing database connection...');
    await pool.query('SELECT 1 as test');
    console.log('✅ Connection successful\n');

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'db', 'migrations', '064_enhance_events_schema.sql');
    console.log(`Reading migration file: ${migrationPath}`);
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('✅ Migration file read\n');

    // Run migration
    console.log('Running migration...');
    await pool.query(migrationSQL);
    console.log('✅ Migration completed successfully\n');

    // Verify columns were added
    console.log('Verifying columns...');
    const verifyQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'events' 
      AND column_name IN ('max_bookings', 'price_per_booking', 'inclusions', 'exclusions', 'terms_and_conditions', 'cancellation_policy', 'refund_policy', 'registration_rules')
      ORDER BY column_name;
    `;
    const result = await pool.query(verifyQuery);
    
    if (result.rows.length > 0) {
      console.log('✅ Columns verified:');
      result.rows.forEach(row => {
        console.log(`   - ${row.column_name} (${row.data_type})`);
      });
    } else {
      console.log('⚠️  Warning: No new columns found. They may have already existed.');
    }
    
    console.log('');

    await pool.end();
    console.log('✅ Migration process completed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    await pool.end();
    process.exit(1);
  }
}

runMigration();
