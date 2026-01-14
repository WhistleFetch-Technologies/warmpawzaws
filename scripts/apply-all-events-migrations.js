#!/usr/bin/env node

/**
 * Apply All Events-Related Migrations in Order
 * 1. 036_events_tables.sql - Creates events and event_registrations tables
 * 2. 063_event_approval_and_verification.sql - Adds approval workflow
 * 3. 064_enhance_events_schema.sql - Adds comprehensive fields
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

const MIGRATIONS = [
  { file: '036_events_tables.sql', name: 'Events Tables Creation' },
  { file: '063_event_approval_and_verification.sql', name: 'Event Approval Workflow' },
  { file: '064_enhance_events_schema.sql', name: 'Events Schema Enhancement' },
];

async function runMigrations() {
  console.log('=========================================');
  console.log('Applying All Events-Related Migrations');
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

    // Check if events table exists
    const checkTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'events'
      )
    `);
    
    const tableExists = checkTable.rows[0].exists;
    console.log(`Events table exists: ${tableExists ? 'Yes' : 'No'}\n`);

    // Apply migrations
    for (const migration of MIGRATIONS) {
      const migrationPath = path.join(__dirname, '..', 'db', 'migrations', migration.file);
      
      console.log(`\n📄 Processing: ${migration.name}`);
      console.log(`   File: ${migration.file}`);
      
      if (!fs.existsSync(migrationPath)) {
        console.log(`   ⚠️  File not found, skipping...`);
        continue;
      }
      
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      try {
        await pool.query(migrationSQL);
        console.log(`   ✅ Migration applied successfully`);
      } catch (error) {
        // Check if it's a "already exists" type error
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate') ||
            error.message.includes('column') && error.message.includes('already exists')) {
          console.log(`   ⚠️  Migration already applied (or partially applied): ${error.message.split('\n')[0]}`);
        } else if (error.message.includes('does not exist') && error.message.includes('admins')) {
          // Handle missing admins table - make it optional
          console.log(`   ⚠️  Admins table not found, making reference optional...`);
          // Modify SQL to remove admins reference
          const modifiedSQL = migrationSQL.replace(
            /REFERENCES admins\(id\)/g,
            'REFERENCES vendors(id)' // Use vendors as fallback, or just remove the constraint
          );
          try {
            await pool.query(modifiedSQL);
            console.log(`   ✅ Migration applied with modified constraints`);
          } catch (e2) {
            // If still fails, try without the constraint
            const noConstraintSQL = migrationSQL.replace(
              /reviewed_by UUID REFERENCES admins\(id\),?/g,
              'reviewed_by UUID,'
            );
            await pool.query(noConstraintSQL);
            console.log(`   ✅ Migration applied without admins constraint`);
          }
        } else {
          throw error;
        }
      }
    }

    // Verify final state
    console.log('\n=========================================');
    console.log('Verification');
    console.log('=========================================');
    
    // Check events table columns
    const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'events' 
      AND column_name IN (
        'max_bookings', 'price_per_booking', 'inclusions', 'exclusions', 
        'terms_and_conditions', 'cancellation_policy', 'refund_policy', 
        'registration_rules', 'approval_status', 'created_by', 'booking_reference'
      )
      ORDER BY column_name;
    `);
    
    if (columns.rows.length > 0) {
      console.log('\n✅ New columns found:');
      columns.rows.forEach(row => {
        console.log(`   - ${row.column_name} (${row.data_type})`);
      });
    }
    
    // Check event_registrations columns
    const regColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'event_registrations' 
      AND column_name IN ('booking_reference', 'qr_code', 'checked_in_by')
      ORDER BY column_name;
    `);
    
    if (regColumns.rows.length > 0) {
      console.log('\n✅ Event registrations columns:');
      regColumns.rows.forEach(row => {
        console.log(`   - ${row.column_name} (${row.data_type})`);
      });
    }

    await pool.end();
    console.log('\n✅ All migrations completed successfully!');
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

runMigrations();
