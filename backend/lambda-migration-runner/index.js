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
    
    // Get migration status
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
