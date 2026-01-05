#!/usr/bin/env node
/**
 * Run All Migrations Script
 * Executes all SQL migration files in numerical order
 * 
 * Usage: node db/run-migration-all.js
 * 
 * CRITICAL VALIDATIONS:
 * 1. DATABASE_URL environment variable must exist
 * 2. DATABASE_URL must be non-empty string
 * 3. DATABASE_URL must include protocol (postgresql:// or postgres://)
 * 4. DATABASE_URL must match format: postgresql://user:pass@host:port/db
 * 5. URL parsing must succeed (prevents searchParams undefined error)
 * 6. Database connectivity test must pass before migrations run
 * 
 * This prevents "Cannot read properties of undefined (reading 'searchParams')" errors in CI/CD
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

/**
 * Sanitizes DATABASE_URL for logging (masks password)
 * @param {string} url - The database URL to sanitize
 * @returns {string} Sanitized URL safe for logging
 */
function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '(invalid)';
  // Replace password with *** (pattern: :password@)
  return url.replace(/:[^:@]+@/, ':***@');
}

/**
 * Validates DATABASE_URL with strict checks
 * Exits process with code 1 if validation fails
 * @param {string} databaseUrl - The DATABASE_URL to validate
 * @returns {URL} Parsed URL object if validation succeeds
 */
function validateDatabaseUrl(databaseUrl) {
  // VALIDATION 1: Environment variable exists
  if (!databaseUrl) {
    console.error('');
    console.error('❌ FATAL ERROR: DATABASE_URL environment variable is required');
    console.error('');
    console.error('   Set DATABASE_URL to a valid PostgreSQL connection string:');
    console.error('   postgresql://username:password@host:port/database');
    console.error('');
    console.error('   Or set SUPABASE_DB_URL for Supabase databases');
    console.error('');
    process.exit(1);
  }

  // VALIDATION 2: Must be non-empty string
  if (typeof databaseUrl !== 'string' || databaseUrl.trim() === '') {
    console.error('');
    console.error('❌ FATAL ERROR: DATABASE_URL is defined but empty or invalid');
    console.error(`   Type: ${typeof databaseUrl}`);
    console.error(`   Value: ${databaseUrl}`);
    console.error('');
    process.exit(1);
  }

  // VALIDATION 3: Must have protocol (postgresql:// or postgres://)
  if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
    // Check if it looks like a connection string without protocol
    if (databaseUrl.match(/^[^:]+:[^@]+@[^:]+:\d+\/[^/]+$/)) {
      console.error('');
      console.error('❌ FATAL ERROR: DATABASE_URL is missing protocol');
      console.error('');
      console.error(`   Got: ${databaseUrl.substring(0, 50)}...`);
      console.error('   Expected: postgresql://username:password@host:port/database');
      console.error('');
      console.error('   FIX: Add postgresql:// to the beginning of your DATABASE_URL');
      console.error(`   Correct format: postgresql://${databaseUrl}`);
      console.error('');
      console.error('   This error prevents: "Cannot read properties of undefined (reading \'searchParams\')"');
      console.error('');
      process.exit(1);
    }
  }

  // VALIDATION 4: Must match PostgreSQL URL format
  const urlPattern = /^(postgresql|postgres):\/\/[^:]+:[^@]+@[^:]+:\d+\/[^/]+$/;
  if (!urlPattern.test(databaseUrl)) {
    console.error('');
    console.error('❌ FATAL ERROR: DATABASE_URL has invalid format');
    console.error('');
    console.error('   Expected format: postgresql://username:password@host:port/database');
    console.error(`   Got (sanitized): ${sanitizeUrl(databaseUrl)}`);
    console.error('');
    console.error('   Common issues:');
    console.error('   - Missing protocol (postgresql:// or postgres://)');
    console.error('   - Missing username or password');
    console.error('   - Missing host or port');
    console.error('   - Missing database name');
    console.error('');
    process.exit(1);
  }

  // VALIDATION 5: URL parsing must succeed
  let parsedUrl;
  try {
    parsedUrl = new URL(databaseUrl);
    
    // Validate required components exist
    if (!parsedUrl.hostname || parsedUrl.hostname === '') {
      throw new Error('Hostname is empty');
    }
    if (!parsedUrl.pathname || parsedUrl.pathname === '/' || parsedUrl.pathname === '') {
      throw new Error('Database name is empty');
    }
    if (!parsedUrl.port || parsedUrl.port === '') {
      throw new Error('Port is empty');
    }
    
    // CRITICAL: Ensure searchParams is accessible (prevents undefined.searchParams crash)
    if (typeof parsedUrl.searchParams === 'undefined') {
      throw new Error('URL.searchParams is undefined - URL parsing failed');
    }
    
  } catch (error) {
    console.error('');
    console.error('❌ FATAL ERROR: Failed to parse DATABASE_URL');
    console.error(`   Error: ${error.message}`);
    console.error(`   URL (sanitized): ${sanitizeUrl(databaseUrl)}`);
    console.error('');
    console.error('   This error prevents: "Cannot read properties of undefined (reading \'searchParams\')"');
    console.error('   Common cause: DATABASE_URL is missing protocol (postgresql://)');
    console.error('');
    process.exit(1);
  }

  return parsedUrl;
}

// Get DATABASE_URL from environment
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

// Validate DATABASE_URL with strict checks (exits on failure)
const parsedUrl = validateDatabaseUrl(DATABASE_URL);

async function runAllMigrations() {
  console.log('🚀 Migration Runner - Running All Migrations');
  console.log('='.repeat(60));
  console.log(`🔌 Database: ${sanitizeUrl(DATABASE_URL)}`);
  console.log(`   Host: ${parsedUrl.hostname}`);
  console.log(`   Port: ${parsedUrl.port}`);
  console.log(`   Database: ${parsedUrl.pathname.slice(1)}`);
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
    
    // CRITICAL: Test database connectivity and permissions before running migrations
    console.log('🔍 Verifying database access...');
    try {
      const { rows } = await client.query('SELECT current_database(), current_user, version()');
      console.log(`   Database: ${rows[0].current_database}`);
      console.log(`   User: ${rows[0].current_user}`);
      console.log(`   PostgreSQL: ${rows[0].version.split(',')[0]}`);
      console.log('✅ Database access verified');
      console.log('');
    } catch (error) {
      console.error('');
      console.error('❌ FATAL ERROR: Cannot access database');
      console.error(`   Error: ${error.message}`);
      console.error('');
      console.error('   Possible causes:');
      console.error('   - Database does not exist');
      console.error('   - User does not have permissions');
      console.error('   - Network/firewall blocking connection');
      console.error('');
      process.exit(1);
    }

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

