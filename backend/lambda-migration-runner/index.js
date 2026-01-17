/**
 * Lambda Migration Runner
 * Runs database migrations from within VPC
 */

const AWS = require('aws-sdk');
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

const secretsManager = new AWS.SecretsManager();

exports.handler = async (event) => {
  console.log('🚀 Lambda Migration Runner started');
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // Get RDS credentials from Secrets Manager
    const secretArn = process.env.RDS_SECRET_ARN;
    if (!secretArn) {
      throw new Error('RDS_SECRET_ARN environment variable not set');
    }

    console.log('📦 Fetching credentials from Secrets Manager...');
    const secretData = await secretsManager.getSecretValue({ SecretId: secretArn }).promise();
    const credentials = JSON.parse(secretData.SecretString);

    // Construct DATABASE_URL
    const dbUrl = `postgresql://${credentials.username}:${encodeURIComponent(credentials.password)}@${credentials.host}:${credentials.port || 5432}/${credentials.dbname}`;
    console.log('✅ Credentials retrieved');

    // Create connection pool
    const pool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false }
    });

    // Test connection
    console.log('🔗 Testing database connection...');
    const client = await pool.connect();
    const result = await client.query('SELECT version()');
    console.log('✅ Connected to database:', result.rows[0].version.substring(0, 50));
    
    // Check if this is for instant tele queue migration
    const migrationType = event.migrationType || event.type || 'instant-tele-queue';
    
    if (migrationType === 'instant-tele-queue') {
      console.log('🔄 Running Instant Tele Queue migration...');
      
      // Read migration file
      const migrationPath = path.join(__dirname, '..', 'lambda', 'src', 'database', 'schemas', 'instant-tele-queue.sql');
      const migrationSQL = await fs.readFile(migrationPath, 'utf8');
      
      // Check current state
      console.log('📊 Current database state:');
      const stateResult = await client.query(`
        SELECT 
          CASE 
            WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_tele_availability')
            THEN 'exists'
            ELSE 'missing'
          END as staff_tele_availability_status,
          CASE 
            WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tele_queue')
            THEN 'exists'
            ELSE 'missing'
          END as tele_queue_status;
      `);
      console.log(`   staff_tele_availability: ${stateResult.rows[0].staff_tele_availability_status}`);
      console.log(`   tele_queue: ${stateResult.rows[0].tele_queue_status}`);
      
      // Execute migration
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
          message: 'Instant Tele Queue migration completed successfully',
          tables: tables,
          database: credentials.dbname
        }, null, 2)
      };
    }
    
    // Default: Get migration status
    const statusResult = await client.query(`
      SELECT COUNT(*) as total
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    
    console.log(`📊 Database has ${statusResult.rows[0].total} tables`);
    
    client.release();
    await pool.end();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Migration runner executed successfully',
        database: credentials.dbname,
        tablesCount: statusResult.rows[0].total
      })
    };

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};
