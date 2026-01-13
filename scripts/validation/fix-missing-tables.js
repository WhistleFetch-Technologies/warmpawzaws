#!/usr/bin/env node
/**
 * ============================================================================
 * FIX MISSING TABLES - Run Required Migrations
 * ============================================================================
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_CONFIG = {
  host: 'warmpawz-dev-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
  port: 5432,
  database: 'warmpawz',
  user: 'warmpawz_admin',
  password: 'Warmpawz2026',
  ssl: { rejectUnauthorized: false }
};

const REQUIRED_MIGRATIONS = [
  '057_vendor_capabilities_tables.sql',
  '019_insurance_tables.sql',
  '022_training_progress_tables.sql',
  '031_video_call_rooms_table.sql',
  '032_video_call_and_package_sessions.sql',
  '035_chat_and_subscription_tables.sql',
  '031_gps_tracking_tables.sql',
];

async function runMigrations() {
  const pool = new Pool(DB_CONFIG);
  
  try {
    console.log('🔧 Fixing Missing Tables...\n');
    
    // Check which tables are missing
    const missingTables = [];
    const tablesToCheck = [
      'capabilities',
      'role_capabilities',
      'insurance_policies',
      'training_sessions',
      'chat_messages',
      'video_call_rooms',
      'gps_tracking'
    ];
    
    for (const table of tablesToCheck) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        )
      `, [table]);
      
      if (!result.rows[0].exists) {
        missingTables.push(table);
        console.log(`❌ Table missing: ${table}`);
      } else {
        console.log(`✅ Table exists: ${table}`);
      }
    }
    
    if (missingTables.length === 0) {
      console.log('\n✅ All required tables exist!');
      await pool.end();
      return 0;
    }
    
    console.log(`\n📋 Need to create ${missingTables.length} tables\n`);
    
    // Run migrations
    const migrationsDir = path.join(__dirname, '../../db/migrations');
    
    for (const migrationFile of REQUIRED_MIGRATIONS) {
      const migrationPath = path.join(migrationsDir, migrationFile);
      
      if (!fs.existsSync(migrationPath)) {
        console.log(`⚠️  Migration not found: ${migrationFile}`);
        continue;
      }
      
      console.log(`📝 Running migration: ${migrationFile}...`);
      
      try {
        const sql = fs.readFileSync(migrationPath, 'utf8');
        
        // Execute migration
        await pool.query(sql);
        
        console.log(`✅ Migration successful: ${migrationFile}`);
      } catch (error) {
        // Check if error is just "table already exists"
        if (error.message.includes('already exists')) {
          console.log(`⚠️  Migration skipped (tables exist): ${migrationFile}`);
        } else {
          console.error(`❌ Migration failed: ${migrationFile}`);
          console.error(`   Error: ${error.message}`);
        }
      }
    }
    
    // Verify all tables now exist
    console.log('\n🔍 Verifying tables...\n');
    let allExist = true;
    
    for (const table of tablesToCheck) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        )
      `, [table]);
      
      if (result.rows[0].exists) {
        console.log(`✅ ${table}`);
      } else {
        console.log(`❌ ${table} - STILL MISSING`);
        allExist = false;
      }
    }
    
    await pool.end();
    
    if (allExist) {
      console.log('\n✅ All tables created successfully!');
      return 0;
    } else {
      console.log('\n❌ Some tables still missing');
      return 1;
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
    await pool.end();
    return 1;
  }
}

runMigrations().then(exitCode => {
  process.exit(exitCode);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
