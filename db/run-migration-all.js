#!/usr/bin/env node
/**
 * Run All Migrations Script
 * Executes all SQL migration files in numerical order
 * 
 * Usage: node db/run-migration-all.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database URL from environment or default
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL or SUPABASE_DB_URL environment variable is required');
  process.exit(1);
}

async function runAllMigrations() {
  console.log('🚀 Migration Runner - Running All Migrations');
  console.log('='.repeat(60));
  console.log(`🔌 Database: ${DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);
  console.log('');

  const migrationsDir = path.join(__dirname, 'migrations');
  
  // Read all migration files and sort them
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort((a, b) => {
      // Extract numeric prefix for sorting
      const numA = parseInt(a.split('_')[0]);
      const numB = parseInt(b.split('_')[0]);
      return numA - numB;
    });

  console.log(`📁 Found ${files.length} migration files`);
  console.log('');

  const pool = new Pool({ 
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : undefined
  });

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  try {
    console.log('🔗 Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Connected successfully');
    console.log('');

    // Run each migration
    for (const file of files) {
      const migrationPath = path.join(migrationsDir, file);
      console.log(`⚙️  Running: ${file}`);
      
      try {
        const sql = fs.readFileSync(migrationPath, 'utf8');
        
        // Skip if file is empty or only contains comments
        const hasContent = sql.split('\n').some(line => {
          const trimmed = line.trim();
          return trimmed && !trimmed.startsWith('--');
        });

        if (!hasContent) {
          console.log(`   ⏭️  Skipped (empty or comments only)`);
          skipCount++;
          continue;
        }

        await client.query(sql);
        console.log(`   ✅ Success`);
        successCount++;
      } catch (error) {
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate key')) {
          console.log(`   ⏭️  Skipped (already applied)`);
          skipCount++;
        } else {
          console.error(`   ❌ Error: ${error.message}`);
          errorCount++;
          
          // Continue with next migration instead of failing completely
          console.log(`   ⚠️  Continuing with remaining migrations...`);
        }
      }
      console.log('');
    }

    client.release();

    // Summary
    console.log('='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ⏭️  Skipped: ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📁 Total: ${files.length}`);
    console.log('');

    if (errorCount > 0) {
      console.log('⚠️  Some migrations encountered errors but process continued');
      console.log('   Review the errors above and ensure database is in expected state');
    } else {
      console.log('✅ All migrations completed successfully!');
    }

  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:');
    console.error(error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations
runAllMigrations();

