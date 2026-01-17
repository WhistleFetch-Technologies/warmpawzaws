/**
 * Lambda Migration Runner for Instant Tele Queue
 * Runs database migrations from within VPC
 */

const AWS = require('aws-sdk');
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

const secretsManager = new AWS.SecretsManager();

exports.handler = async (event) => {
  console.log('🚀 Instant Tele Queue Migration Runner started');
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // Get RDS credentials from Secrets Manager
    const secretArn = process.env.RDS_SECRET_ARN || 'warmpawz-dev-rds-master-20260106164510791100000002';
    
    console.log('📦 Fetching credentials from Secrets Manager...');
    const secretData = await secretsManager.getSecretValue({ SecretId: secretArn }).promise();
    const credentials = JSON.parse(secretData.SecretString);
    
    const dbHost = credentials.host || credentials.endpoint;
    const dbPort = credentials.port || 5432;
    const dbName = credentials.dbname || credentials.database || 'warmpawz';
    const dbUser = credentials.username || credentials.user;
    const dbPassword = credentials.password;

    if (!dbHost || !dbUser || !dbPassword) {
      throw new Error('Missing required database credentials in secret');
    }

    console.log('✅ Credentials retrieved');
    console.log(`   Host: ${dbHost}`);
    console.log(`   Database: ${dbName}`);
    console.log(`   User: ${dbUser}`);

    // Construct DATABASE_URL
    const dbUrl = `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`;
    
    // Create connection pool
    const pool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 30000,
    });

    // Test connection
    console.log('🔗 Testing database connection...');
    const client = await pool.connect();
    const result = await client.query('SELECT version()');
    console.log('✅ Connected to database:', result.rows[0].version.substring(0, 50));
    
    // Check current state
    console.log('📊 Current database state:');
    const stateResult = await client.query(`
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
    console.log(`   ${stateResult.rows[0].tele_queue_status}`);
    
    // Read migration file
    console.log('⚙️  Reading migration file...');
    const migrationPath = path.join(__dirname, '..', 'lambda', 'src', 'database', 'schemas', 'instant-tele-queue.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    // Execute migration
    console.log('🔄 Running migration...');
    try {
      await client.query('BEGIN');
      await client.query(migrationSQL);
      await client.query('COMMIT');
      console.log('✅ Migration completed successfully!');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    
    // Verify tables created
    console.log('🔍 Verifying tables created...');
    const verifyResult = await client.query(`
      SELECT 
        t.table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count,
        (SELECT COUNT(*) FROM information_schema.indexes WHERE tablename = t.table_name) as index_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
        AND table_name IN ('staff_tele_availability', 'tele_queue')
      ORDER BY table_name;
    `);

    const tables = verifyResult.rows.map(row => ({
      table: row.table_name,
      columns: row.column_count,
      indexes: row.index_count
    }));

    client.release();
    await pool.end();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Migration completed successfully',
        tables: tables,
        database: dbName
      }, null, 2)
    };

  } catch (error) {
    console.error('❌ Migration failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Migration failed',
        message: error.message,
        stack: error.stack
      }, null, 2)
    };
  }
};
