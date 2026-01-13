#!/usr/bin/env node

/**
 * Run loyalty_action_rules migration
 * Uses the same database connection as Lambda
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Database credentials from Lambda environment
const DB_HOST = process.env.DB_HOST || 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_NAME = process.env.DB_NAME || 'warmpawz';
const DB_USER = process.env.DB_USER || 'warmpawz_admin';
const DB_PASSWORD = process.env.DB_PASSWORD || 'Warmpawz2026';

async function runMigration() {
  console.log('=========================================');
  console.log('Running Loyalty Action Rules Migration');
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
    const migrationPath = path.join(__dirname, '..', 'db', 'migrations', '043_loyalty_action_rules_table.sql');
    console.log(`Reading migration file: ${migrationPath}`);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('✅ Migration file read\n');

    // Run migration
    console.log('Running migration...');
    await pool.query(migrationSQL);
    console.log('✅ Migration completed successfully\n');

    // Verify table exists
    console.log('Verifying table...');
    const result = await pool.query(`
      SELECT COUNT(*) as rule_count 
      FROM loyalty_action_rules;
    `);
    const count = parseInt(result.rows[0].rule_count, 10);
    console.log(`✅ Table verified: ${count} rules found\n`);

    if (count > 0) {
      console.log('✅ Migration successful! Table exists with data.');
    } else {
      console.log('⚠️  Table exists but no rules found.');
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
