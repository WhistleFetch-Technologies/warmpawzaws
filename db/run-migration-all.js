#!/usr/bin/env node
/**
 * Run All Migrations Script
 * Executes all SQL migration files in numerical order
 * 
 * Usage: node db/run-migration-all.js
 * 
 * SUPPORTED CONFIGURATIONS:
 * 
 * 1) Full DATABASE_URL (preferred):
 *    DATABASE_URL=postgresql://user:pass@host:port/database
 * 
 * 2) Split configuration (legacy/AWS):
 *    DATABASE_URL=host:port/database (or full RDS endpoint)
 *    DB_USER=username
 *    DB_PASSWORD=password
 * 
 * 3) Individual components:
 *    DB_HOST=host
 *    DB_PORT=5432
 *    DB_NAME=database
 *    DB_USER=username
 *    DB_PASSWORD=password
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

/**
 * Masks a hostname for safe logging (shows first and last parts)
 * @param {string} hostname 
 * @returns {string}
 */
function maskHostname(hostname) {
  if (!hostname || typeof hostname !== 'string') return '(unknown)';
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname; // Don't mask short hostnames
  // Show first and last two parts, mask middle
  if (parts.length > 4) {
    return parts[0] + '.***.' + parts.slice(-2).join('.');
  }
  return hostname;
}

/**
 * Masks a URL for safe logging (hides credentials, partially masks host)
 * @param {string} url 
 * @returns {string}
 */
function maskUrl(url) {
  if (!url || typeof url !== 'string') return '(invalid)';
  try {
    const parsed = new URL(url);
    const maskedHost = maskHostname(parsed.hostname);
    const db = parsed.pathname ? parsed.pathname.slice(1) : '(unknown)';
    return `postgresql://***:***@${maskedHost}:${parsed.port}/${db}`;
  } catch {
    // Can't parse - do basic masking
    return url
      .replace(/\/\/[^:]+:[^@]+@/, '//***:***@')
      .replace(/:[^:@\/]+@/, ':***@')
      .substring(0, 60) + (url.length > 60 ? '...' : '');
  }
}

/**
 * Attempts to extract host, port, and database from a partial URL string
 * @param {string} rawUrl - Something like "host:port/db" or "host.rds.amazonaws.com:5432/mydb"
 * @returns {{ host: string, port: string, database: string } | null}
 */
function parsePartialUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  
  const trimmed = rawUrl.trim();
  
  // Pattern: host:port/database
  const match = trimmed.match(/^([a-zA-Z0-9.-]+):(\d+)\/(\w+)$/);
  if (match) {
    return {
      host: match[1],
      port: match[2],
      database: match[3]
    };
  }
  
  // Pattern: might have user:pass@ prefix, strip it
  const withCreds = trimmed.match(/^[^:]+:[^@]+@([a-zA-Z0-9.-]+):(\d+)\/(\w+)$/);
  if (withCreds) {
    return {
      host: withCreds[1],
      port: withCreds[2],
      database: withCreds[3]
    };
  }
  
  return null;
}

/**
 * Builds and validates a PostgreSQL connection URL from available configuration
 * 
 * Priority:
 * 1. Try DATABASE_URL as-is (if it's a complete URL)
 * 2. Reconstruct from DATABASE_URL + DB_USER/DB_PASSWORD
 * 3. Build from individual components (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
 * 
 * @returns {string} Valid PostgreSQL connection URL
 */
function buildAndValidateDatabaseUrl() {
  const rawDatabaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  const dbUser = process.env.DB_USER || process.env.PGUSER;
  const dbPassword = process.env.DB_PASSWORD || process.env.PGPASSWORD;
  const dbHost = process.env.DB_HOST || process.env.PGHOST;
  const dbPort = process.env.DB_PORT || process.env.PGPORT || '5432';
  const dbName = process.env.DB_NAME || process.env.PGDATABASE;

  // ============================================
  // ATTEMPT 1: Try DATABASE_URL as complete URL
  // ============================================
  if (rawDatabaseUrl) {
    // Check if it already has a protocol
    if (rawDatabaseUrl.startsWith('postgresql://') || rawDatabaseUrl.startsWith('postgres://')) {
      try {
        const parsed = new URL(rawDatabaseUrl);
        
        // Validate required components
        if (!parsed.hostname) throw new Error('Missing hostname');
        if (!parsed.pathname || parsed.pathname === '/') throw new Error('Missing database name');
        
        // Check if credentials exist in URL
        if (parsed.username && parsed.password) {
          console.log('✅ Using complete DATABASE_URL');
          return rawDatabaseUrl;
        }
        
        // URL has protocol but missing credentials - try to add them
        if (dbUser && dbPassword) {
          parsed.username = encodeURIComponent(dbUser);
          parsed.password = encodeURIComponent(dbPassword);
          console.log('✅ Using DATABASE_URL with credentials from DB_USER/DB_PASSWORD');
          return parsed.toString();
        }
        
        // No credentials available - might be using IAM auth, continue anyway
        console.warn('⚠️  DATABASE_URL has no credentials - assuming IAM auth or trust auth');
        return rawDatabaseUrl;
        
      } catch (error) {
        console.error('');
        console.error('❌ DATABASE_URL has protocol but failed to parse: ' + error.message);
        console.error('');
        process.exit(1);
      }
    }
    
    // ============================================
    // ATTEMPT 2: DATABASE_URL without protocol
    // Try to reconstruct with credentials
    // ============================================
    const partialParsed = parsePartialUrl(rawDatabaseUrl);
    
    if (partialParsed) {
      console.log('ℹ️  DATABASE_URL is missing protocol, attempting reconstruction...');
      
      const { host, port, database } = partialParsed;
      
      // Check for credentials
      if (dbUser && dbPassword) {
        const reconstructed = `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPassword)}@${host}:${port}/${database}`;
        
        // Validate the reconstructed URL
        try {
          const parsed = new URL(reconstructed);
          if (!parsed.hostname) throw new Error('Invalid hostname');
          console.log('✅ Reconstructed DATABASE_URL from partial URL + DB_USER/DB_PASSWORD');
          console.log('   Host: ' + maskHostname(host));
          console.log('   Port: ' + port);
          console.log('   Database: ' + database);
          return reconstructed;
        } catch (error) {
          console.error('');
          console.error('❌ Failed to reconstruct valid URL: ' + error.message);
          console.error('');
          process.exit(1);
        }
      }
      
      // No credentials - try without (for IAM auth)
      const noCredsUrl = `postgresql://${host}:${port}/${database}`;
      try {
        new URL(noCredsUrl);
        console.warn('⚠️  Using DATABASE_URL without credentials - assuming IAM/trust auth');
        console.warn('   If connection fails, set DB_USER and DB_PASSWORD');
        return noCredsUrl;
      } catch (error) {
        console.error('');
        console.error('❌ Cannot construct valid URL from DATABASE_URL');
        console.error('   Raw value looks like: ' + maskHostname(host) + ':' + port + '/***');
        console.error('   Error: ' + error.message);
        console.error('');
        process.exit(1);
      }
    }
    
    // DATABASE_URL exists but couldn't parse it at all
    console.error('');
    console.error('❌ FATAL: DATABASE_URL has invalid format');
    console.error('');
    console.error('   Expected formats:');
    console.error('   - postgresql://user:pass@host:port/database');
    console.error('   - host:port/database (with DB_USER/DB_PASSWORD set)');
    console.error('');
    console.error('   Got something that does not match either pattern');
    console.error('');
    process.exit(1);
  }
  
  // ============================================
  // ATTEMPT 3: Build from individual components
  // ============================================
  if (dbHost && dbName) {
    console.log('ℹ️  Building DATABASE_URL from individual components...');
    
    if (!dbUser || !dbPassword) {
      console.error('');
      console.error('❌ FATAL: DB_USER and DB_PASSWORD are required when using DB_HOST/DB_NAME');
      console.error('');
      console.error('   Found:');
      console.error('   - DB_HOST: ' + (dbHost ? maskHostname(dbHost) : '(missing)'));
      console.error('   - DB_PORT: ' + dbPort);
      console.error('   - DB_NAME: ' + (dbName ? dbName : '(missing)'));
      console.error('   - DB_USER: ' + (dbUser ? '(set)' : '❌ MISSING'));
      console.error('   - DB_PASSWORD: ' + (dbPassword ? '(set)' : '❌ MISSING'));
      console.error('');
      process.exit(1);
    }
    
    const constructed = `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`;
    
    try {
      const parsed = new URL(constructed);
      if (!parsed.hostname) throw new Error('Invalid hostname');
      console.log('✅ Built DATABASE_URL from components');
      console.log('   Host: ' + maskHostname(dbHost));
      console.log('   Port: ' + dbPort);
      console.log('   Database: ' + dbName);
      return constructed;
    } catch (error) {
      console.error('');
      console.error('❌ Failed to construct valid URL from components: ' + error.message);
      console.error('');
      process.exit(1);
    }
  }
  
  // ============================================
  // No configuration found
  // ============================================
  console.error('');
  console.error('❌ FATAL: No database configuration found');
  console.error('');
  console.error('   Provide ONE of the following:');
  console.error('');
  console.error('   Option 1 - Full DATABASE_URL:');
  console.error('     DATABASE_URL=postgresql://user:pass@host:port/database');
  console.error('');
  console.error('   Option 2 - Partial URL with credentials:');
  console.error('     DATABASE_URL=host:port/database');
  console.error('     DB_USER=username');
  console.error('     DB_PASSWORD=password');
  console.error('');
  console.error('   Option 3 - Individual components:');
  console.error('     DB_HOST=hostname');
  console.error('     DB_PORT=5432');
  console.error('     DB_NAME=database');
  console.error('     DB_USER=username');
  console.error('     DB_PASSWORD=password');
  console.error('');
  process.exit(1);
}

// Build and validate the database URL (exits on failure)
const DATABASE_URL = buildAndValidateDatabaseUrl();

// Parse the final URL to extract components for logging
let parsedUrl;
try {
  parsedUrl = new URL(DATABASE_URL);
} catch (error) {
  console.error('❌ FATAL: Final DATABASE_URL is invalid (this should not happen)');
  console.error('   Error: ' + error.message);
  process.exit(1);
}

async function runAllMigrations() {
  console.log('');
  console.log('🚀 Migration Runner - Running All Migrations');
  console.log('='.repeat(60));
  console.log('🔌 Database: ' + maskUrl(DATABASE_URL));
  console.log('   Host: ' + maskHostname(parsedUrl.hostname));
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
  let files;
  try {
    files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort((a, b) => {
        const numA = parseInt(a.split('_')[0]) || 0;
        const numB = parseInt(b.split('_')[0]) || 0;
        return numA - numB;
      });
  } catch (error) {
    console.error('❌ Failed to read migrations directory: ' + error.message);
    process.exit(1);
  }

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
    
    // Test database connectivity
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
      console.error('❌ FATAL: Cannot access database');
      console.error('   Error: ' + error.message);
      console.error('');
      console.error('   Possible causes:');
      console.error('   - Invalid credentials');
      console.error('   - Database does not exist');
      console.error('   - Network/firewall blocking connection');
      console.error('   - SSL configuration mismatch');
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
          // Show first 3 lines of error for context
          const errorLines = error.message.split('\n').slice(0, 3);
          if (errorLines.length > 1) {
            errorLines.forEach((line, idx) => {
              if (idx > 0) console.error('      ' + line);
            });
          }
          errorCount++;
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
    console.error('❌ Migration failed: ' + error.message);
    console.error('');
    await pool.end();
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations
runAllMigrations();
