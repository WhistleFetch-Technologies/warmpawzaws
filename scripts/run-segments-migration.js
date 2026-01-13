#!/usr/bin/env node

/**
 * Run loyalty_segments migration
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
  console.log('Running Loyalty Segments Migration');
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

    // Check if table exists
    console.log('Checking if loyalty_segments table exists...');
    const check = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'loyalty_segments'
      )
    `);
    
    if (check.rows[0].exists) {
      console.log('✅ Table already exists');
      const count = await pool.query('SELECT COUNT(*) as count FROM loyalty_segments');
      console.log(`   Segments count: ${count.rows[0].count}\n`);
    } else {
      // Read migration file
      const migrationPath = path.join(__dirname, '..', 'db', 'migrations', '064_loyalty_segments_system.sql');
      console.log(`Reading migration file: ${migrationPath}`);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      console.log('✅ Migration file read\n');

      // Run migration
      console.log('Running migration...');
      await pool.query(migrationSQL);
      console.log('✅ Migration completed successfully\n');

      // Verify table exists
      console.log('Verifying table...');
      const count = await pool.query('SELECT COUNT(*) as count FROM loyalty_segments');
      console.log(`✅ Table verified: ${count.rows[0].count} segments found\n`);
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
