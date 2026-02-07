#!/usr/bin/env node

/**
 * ============================================================================
 * Run Instant Tele Queue Database Migration (Node.js version)
 * ============================================================================
 * 
 * Runs the instant tele queue database migration using Node.js pg client
 * Works without requiring psql command line tool
 * 
 * Usage:
 *   node scripts/run-instant-tele-queue-migration.js
 *   node scripts/run-instant-tele-queue-migration.js <db-host> <db-user> <db-name>
 * 
 * Environment variables:
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 *   DATABASE_URL (postgresql://user:pass@host:port/dbname)
 * ============================================================================
 */

const { Pool } = require('pg');
const fs = require('fs');
const { join } = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function getPassword() {
  return new Promise((resolve) => {
    process.stdout.write('Enter database password: ');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    let password = '';
    process.stdin.on('data', (char) => {
      char = char.toString();
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\n');
          resolve(password);
          break;
        case '\u0003':
          process.exit();
          break;
        case '\u007f': // backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          password += char;
          process.stdout.write('*');
          break;
      }
    });
  });
}

async function main() {
  console.log('🚀 Starting Instant Tele Queue Database Migration...\n');

  // Get database connection details
  let dbHost = process.env.DB_HOST || process.env.RDS_HOSTNAME;
  let dbPort = parseInt(process.env.DB_PORT || '5432', 10);
  let dbName = process.env.DB_NAME || process.env.RDS_DB_NAME || 'warmpawz_db';
  let dbUser = process.env.DB_USER || process.env.RDS_USERNAME;
  let dbPassword = process.env.DB_PASSWORD || process.env.RDS_PASSWORD;
  let databaseUrl = process.env.DATABASE_URL;

  // Try command line arguments
  if (process.argv[2]) dbHost = process.argv[2];
  if (process.argv[3]) dbUser = process.argv[3];
  if (process.argv[4]) dbName = process.argv[4];

  // Prompt for missing values
  if (!databaseUrl) {
    if (!dbHost) {
      dbHost = await question('Enter database host: ');
    }

    if (!dbUser) {
      dbUser = await question('Enter database username: ');
    }

    if (!dbName) {
      const input = await question(`Enter database name [${dbName}]: `);
      if (input) dbName = input;
    }

    if (!dbPassword) {
      dbPassword = await getPassword();
    }

    databaseUrl = `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`;
  }

  // Read migration file
  const migrationFile = join(__dirname, '..', 'backend', 'lambda', 'src', 'database', 'schemas', 'instant-tele-queue.sql');
  
  if (!fs.existsSync(migrationFile)) {
    console.error(`❌ Error: Migration file not found: ${migrationFile}`);
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

  console.log(`📁 Migration file: ${migrationFile}`);
  console.log(`🔌 Connecting to database: ${dbHost}:${dbPort}/${dbName}\n`);

  // Create connection pool
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.DB_SSL !== 'false' ? { rejectUnauthorized: false } : false,
  });

  try {
    // Test connection
    console.log('🔍 Testing database connection...');
    const testClient = await pool.connect();
    const versionResult = await testClient.query('SELECT version()');
    console.log('✅ Database connection successful');
    console.log(`   PostgreSQL: ${versionResult.rows[0].version.split(' ')[0]} ${versionResult.rows[0].version.split(' ')[1]}\n`);
    testClient.release();

    // Check current state
    console.log('📊 Current database state:');
    const stateResult = await pool.query(`
      SELECT 
        CASE 
          WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_tele_availability')
          THEN '✅ staff_tele_availability exists'
          ELSE '❌ staff_tele_availability missing'
        END as staff_tele_availability_status,
        CASE 
          WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tele_queue')
          THEN '✅ tele_queue exists'
          ELSE '❌ tele_queue missing'
        END as tele_queue_status;
    `);
    console.log(`   ${stateResult.rows[0].staff_tele_availability_status}`);
    console.log(`   ${stateResult.rows[0].tele_queue_status}\n`);

    // Check if tables already exist
    const existingCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('staff_tele_availability', 'tele_queue');
    `);

    if (existingCheck.rows.length === 2) {
      console.log('⚠️  Tables already exist. Migration will use CREATE TABLE IF NOT EXISTS.');
      const proceed = await question('Continue anyway? (y/n): ');
      if (proceed.toLowerCase() !== 'y') {
        console.log('Migration cancelled.');
        process.exit(0);
      }
    }

    console.log('🔄 Running migration...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Execute migration
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Execute the migration SQL
      await client.query(migrationSQL);
      
      await client.query('COMMIT');
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('\n✅ Migration completed successfully!\n');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // Verify tables created
    console.log('📊 Verifying tables created:');
    const verifyResult = await pool.query(`
      SELECT 
        t.table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count,
        (SELECT COUNT(*) FROM information_schema.indexes WHERE tablename = t.table_name) as index_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
        AND table_name IN ('staff_tele_availability', 'tele_queue')
      ORDER BY table_name;
    `);

    console.table(verifyResult.rows.map(row => ({
      Table: row.table_name,
      Columns: row.column_count,
      Indexes: row.index_count
    })));

    // Check indexes
    console.log('\n📑 Created indexes:');
    const indexesResult = await pool.query(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE tablename IN ('staff_tele_availability', 'tele_queue')
      ORDER BY tablename, indexname;
    `);

    indexesResult.rows.forEach(idx => {
      console.log(`   ✅ ${idx.indexname} on ${idx.tablename}`);
    });

    console.log('\n✅ Migration verification complete!\n');
    console.log('🎉 Next steps:');
    console.log('   1. Deploy backend Lambda function');
    console.log('   2. Deploy frontend applications');
    console.log('   3. Test the features\n');

  } catch (error) {
    console.error('\n❌ Migration failed!');
    console.error(`   Error: ${error.message}`);
    if (error.detail) {
      console.error(`   Detail: ${error.detail}`);
    }
    if (error.position) {
      console.error(`   Position: ${error.position}`);
    }
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
    rl.close();
  }
}

// Run migration
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
