#!/usr/bin/env node
/**
 * Run All Migrations Script
 * Executes all SQL migration files in numerical order
 * 
 * Usage: node db/run-migration-all.js
 * 
 * CRITICAL VALIDATIONS:
 * 1. DATABASE_URL environment variable must exist
 * 2. DATABASE_URL is auto-normalized if protocol is missing
 * 3. URL parsing must succeed after normalization
 * 4. Database connectivity test must pass before migrations run
 * 
 * NORMALIZATION:
 * - If DATABASE_URL looks like host:port/db or user:pass@host:port/db
 *   but is missing postgresql://, it will be auto-prefixed
 * - A warning is logged when auto-fixing occurs
 * - Credentials are never logged
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

/**
 * Masks credentials in a URL for safe logging
 * @param {string} url - The database URL to sanitize
 * @returns {string} Sanitized URL safe for logging
 */
function maskCredentials(url) {
  if (!url || typeof url !== 'string') return '(invalid)';
  
  try {
    // Try to parse and mask properly
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '***';
    }
    if (parsed.username) {
      // Keep first char of username for debugging, mask rest
      parsed.username = parsed.username.charAt(0) + '***';
    }
    return parsed.toString();
  } catch {
    // Fallback: regex-based masking for unparseable URLs
    // Mask user:pass@ pattern
    let masked = url.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
    // Mask any remaining password-like patterns
    masked = masked.replace(/:[^:@\/]+@/, ':***@');
    // Truncate if too long
    if (masked.length > 80) {
      masked = masked.substring(0, 80) + '...';
    }
    return masked;
  }
}

/**
 * Normalizes and validates DATABASE_URL
 * - Auto-prefixes postgresql:// if protocol is missing
 * - Validates URL structure after normalization
 * - Never throws - exits with code 1 on unrecoverable errors
 * 
 * @param {string} rawUrl - The raw DATABASE_URL from environment
 * @returns {{ normalizedUrl: string, parsedUrl: URL }} Normalized URL and parsed URL object
 */
function normalizeAndValidateDatabaseUrl(rawUrl) {
  // VALIDATION 1: Environment variable exists and is non-empty
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    console.error('');
    console.error('❌ FATAL ERROR: DATABASE_URL environment variable is required');
    console.error('');
    console.error('   Set DATABASE_URL to a valid PostgreSQL connection string:');
    console.error('   postgresql://username:password@host:port/database');
    console.error('');
    console.error('   Or for AWS RDS:');
    console.error('   postgresql://host:port/database (with IAM auth)');
    console.error('');
    process.exit(1);
  }

  let normalizedUrl = rawUrl.trim();
  let wasNormalized = false;

  // NORMALIZATION: Auto-prefix protocol if missing
  if (!normalizedUrl.startsWith('postgresql://') && !normalizedUrl.startsWith('postgres://')) {
    // Check if it looks like a valid connection string without protocol
    // Pattern 1: host:port/database (AWS RDS style)
    // Pattern 2: user:pass@host:port/database (full style)
    const looksLikeHostPortDb = /^[a-zA-Z0-9.-]+:\d+\/\w+/.test(normalizedUrl);
    const looksLikeUserPassHostPortDb = /^[^:]+:[^@]+@[a-zA-Z0-9.-]+:\d+\/\w+/.test(normalizedUrl);
    
    if (looksLikeHostPortDb || looksLikeUserPassHostPortDb) {
      console.warn('');
      console.warn('⚠️  WARNING: DATABASE_URL is missing protocol prefix');
      console.warn('   Auto-fixing by adding postgresql:// prefix');
      console.warn('');
      normalizedUrl = 'postgresql://' + normalizedUrl;
      wasNormalized = true;
    } else {
      // Doesn't look like any recognizable format
      console.error('');
      console.error('❌ FATAL ERROR: DATABASE_URL has invalid format');
      console.error('');
      console.error('   Expected formats:');
      console.error('   - postgresql://username:password@host:port/database');
      console.error('   - postgresql://host:port/database (for IAM auth)');
      console.error('   - host:port/database (will be auto-prefixed)');
      console.error('');
      console.error('   Got (masked): ' + maskCredentials(rawUrl));
      console.error('');
      process.exit(1);
    }
  }

  // VALIDATION 2: URL parsing must succeed
  let parsedUrl;
  try {
    parsedUrl = new URL(normalizedUrl);
  } catch (error) {
    console.error('');
    console.error('❌ FATAL ERROR: Failed to parse DATABASE_URL');
    console.error('   Error: ' + error.message);
    console.error('   URL (masked): ' + maskCredentials(normalizedUrl));
    console.error('');
    process.exit(1);
  }

  // VALIDATION 3: Required components exist
  if (!parsedUrl.hostname || parsedUrl.hostname === '') {
    console.error('');
    console.error('❌ FATAL ERROR: DATABASE_URL is missing hostname');
    console.error('   URL (masked): ' + maskCredentials(normalizedUrl));
    console.error('');
    process.exit(1);
  }

  if (!parsedUrl.port || parsedUrl.port === '') {
    console.error('');
    console.error('❌ FATAL ERROR: DATABASE_URL is missing port');
    console.error('   URL (masked): ' + maskCredentials(normalizedUrl));
    console.error('');
    process.exit(1);
  }

  if (!parsedUrl.pathname || parsedUrl.pathname === '/' || parsedUrl.pathname === '') {
    console.error('');
    console.error('❌ FATAL ERROR: DATABASE_URL is missing database name');
    console.error('   URL (masked): ' + maskCredentials(normalizedUrl));
    console.error('');
    process.exit(1);
  }

  // VALIDATION 4: searchParams is accessible (prevents undefined.searchParams crash)
  if (typeof parsedUrl.searchParams === 'undefined') {
    console.error('');
    console.error('❌ FATAL ERROR: URL parsing incomplete - searchParams undefined');
    console.error('   This should not happen with valid URLs');
    console.error('');
    process.exit(1);
  }

  // Log success info
  if (wasNormalized) {
    console.log('✅ DATABASE_URL normalized successfully');
    console.log('');
  }

  return {
    normalizedUrl,
    parsedUrl
  };
}

// Get DATABASE_URL from environment
const RAW_DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

// Normalize and validate DATABASE_URL (exits on failure)
const { normalizedUrl: DATABASE_URL, parsedUrl } = normalizeAndValidateDatabaseUrl(RAW_DATABASE_URL);

async function runAllMigrations() {
  console.log('🚀 Migration Runner - Running All Migrations');
  console.log('='.repeat(60));
  console.log('🔌 Database: ' + maskCredentials(DATABASE_URL));
  console.log('   Host: ' + parsedUrl.hostname);
  console.log('   Port: ' + parsedUrl.port);
  console.log('   Database: ' + parsedUrl.pathname.slice(1));
  console.log('');

  const migrationsDir = path.join(__dirname, 'migrations');
  
  // Check if migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    console.warn('⚠️  Migrations directory not found: ' + migrationsDir);
    console.warn('   Creating empty migrations directory...');
    fs.mkdirSync(migrationsDir, { recursive: true });
  }
  
  // Read all migration files and sort them
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort((a, b) => {
      // Extract numeric prefix for sorting
      const numA = parseInt(a.split('_')[0]) || 0;
      const numB = parseInt(b.split('_')[0]) || 0;
      return numA - numB;
    });

  console.log('📁 Found ' + files.length + ' migration files');
  console.log('');

  if (files.length === 0) {
    console.log('ℹ️  No migration files to run');
    console.log('   Add .sql files to: ' + migrationsDir);
    console.log('');
    return;
  }

  // Build connection config
  const poolConfig = {
    connectionString: DATABASE_URL,
  };

  // Add SSL for RDS/Supabase
  if (DATABASE_URL.includes('rds.amazonaws.com') || DATABASE_URL.includes('supabase')) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  const pool = new Pool(poolConfig);

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
      console.log('   Database: ' + rows[0].current_database);
      console.log('   User: ' + rows[0].current_user);
      console.log('   PostgreSQL: ' + rows[0].version.split(',')[0]);
      console.log('✅ Database access verified');
      console.log('');
    } catch (error) {
      console.error('');
      console.error('❌ FATAL ERROR: Cannot access database');
      console.error('   Error: ' + error.message);
      console.error('');
      console.error('   Possible causes:');
      console.error('   - Database does not exist');
      console.error('   - User does not have permissions');
      console.error('   - Network/firewall blocking connection');
      console.error('   - Missing username/password for non-IAM auth');
      console.error('');
      client.release();
      await pool.end();
      process.exit(1);
    }

    // Run each migration
    for (const file of files) {
      const migrationPath = path.join(migrationsDir, file);
      console.log('⚙️  Running: ' + file);
      
      try {
        const sql = fs.readFileSync(migrationPath, 'utf8');
        
        // Skip if file is empty or only contains comments
        const hasContent = sql.split('\n').some(line => {
          const trimmed = line.trim();
          return trimmed && !trimmed.startsWith('--');
        });

        if (!hasContent) {
          console.log('   ⏭️  Skipped (empty or comments only)');
          skipCount++;
          continue;
        }

        await client.query(sql);
        console.log('   ✅ Success');
        successCount++;
      } catch (error) {
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate key')) {
          console.log('   ⏭️  Skipped (already applied)');
          skipCount++;
        } else {
          console.error('   ❌ Error: ' + error.message);
          errorCount++;
          
          // Continue with next migration instead of failing completely
          console.log('   ⚠️  Continuing with remaining migrations...');
        }
      }
      console.log('');
    }

    client.release();

    // Summary
    console.log('='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('   ✅ Successful: ' + successCount);
    console.log('   ⏭️  Skipped: ' + skipCount);
    console.log('   ❌ Errors: ' + errorCount);
    console.log('   📁 Total: ' + files.length);
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
    console.error('   ' + error.message);
    console.error('');
    await pool.end();
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations
runAllMigrations();
