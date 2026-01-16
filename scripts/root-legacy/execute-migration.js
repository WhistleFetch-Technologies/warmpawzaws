#!/usr/bin/env node
/**
 * Execute Database Migration - Create problem_grid_mappings Table
 * 
 * This script creates the problem_grid_mappings table in the database
 * Can be run with: node execute-migration.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function executeMigration() {
  log('╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║   Database Migration - problem_grid_mappings Table      ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝', 'blue');
  console.log('');

  // Get database connection details
  const dbConfig = {
    host: process.env.DB_HOST || process.env.RDS_HOSTNAME,
    port: process.env.DB_PORT || process.env.RDS_PORT || 5432,
    database: process.env.DB_NAME || process.env.RDS_DB_NAME || 'postgres',
    user: process.env.DB_USER || process.env.RDS_USERNAME,
    password: process.env.DB_PASSWORD || process.env.RDS_PASSWORD,
  };

  // Check if we have required credentials
  if (!dbConfig.host || !dbConfig.user || !dbConfig.password) {
    log('⚠️  Database credentials not found in environment variables.', 'yellow');
    console.log('');
    log('Please set the following environment variables:', 'blue');
    console.log('  DB_HOST or RDS_HOSTNAME - Database host');
    console.log('  DB_PORT or RDS_PORT - Database port (default: 5432)');
    console.log('  DB_NAME or RDS_DB_NAME - Database name (default: postgres)');
    console.log('  DB_USER or RDS_USERNAME - Database user');
    console.log('  DB_PASSWORD or RDS_PASSWORD - Database password');
    console.log('');
    log('Or run the SQL script directly in your database client:', 'blue');
    log('  File: create-problem-grid-table.sql', 'blue');
    console.log('');
    
    // Try to get from AWS Secrets Manager or Parameter Store
    log('Attempting to get credentials from AWS...', 'blue');
    try {
      const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
      const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'ap-south-1' });
      
      // Try common secret names
      const secretNames = [
        'warmpawz/database/credentials',
        'warmpawz/rds/credentials',
        'prod/warmpawz/database',
      ];
      
      for (const secretName of secretNames) {
        try {
          const command = new GetSecretValueCommand({ SecretId: secretName });
          const response = await secretsClient.send(command);
          const secret = JSON.parse(response.SecretString);
          
          dbConfig.host = secret.host || secret.endpoint || dbConfig.host;
          dbConfig.port = secret.port || dbConfig.port;
          dbConfig.database = secret.database || secret.dbname || dbConfig.database;
          dbConfig.user = secret.username || secret.user || dbConfig.user;
          dbConfig.password = secret.password || dbConfig.password;
          
          log(`✅ Found credentials in Secrets Manager: ${secretName}`, 'green');
          break;
        } catch (err) {
          // Try next secret name
          continue;
        }
      }
    } catch (err) {
      log('⚠️  Could not retrieve credentials from AWS Secrets Manager', 'yellow');
    }
    
    // If still no credentials, exit
    if (!dbConfig.host || !dbConfig.user || !dbConfig.password) {
      log('❌ Cannot proceed without database credentials', 'red');
      process.exit(1);
    }
  }

  log('📋 Database Connection', 'blue');
  log('────────────────────────────────────────────────────────────', 'blue');
  log(`Host: ${dbConfig.host}`, 'blue');
  log(`Port: ${dbConfig.port}`, 'blue');
  log(`Database: ${dbConfig.database}`, 'blue');
  log(`User: ${dbConfig.user}`, 'blue');
  console.log('');

  const client = new Client(dbConfig);

  try {
    log('🔍 Testing database connection...', 'blue');
    await client.connect();
    const result = await client.query('SELECT 1 as test');
    log('✅ Database connection successful', 'green');
    console.log('');

    log('📦 Creating problem_grid_mappings table...', 'blue');
    log('────────────────────────────────────────────────────────────', 'blue');

    // Read and execute SQL script
    const sqlFile = path.join(__dirname, 'create-problem-grid-table.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Execute SQL
    await client.query(sql);
    log('✅ Table created successfully', 'green');
    console.log('');

    log('🔍 Verifying table creation...', 'blue');
    log('────────────────────────────────────────────────────────────', 'blue');

    // Verify table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'problem_grid_mappings'
      );
    `);

    if (tableCheck.rows[0].exists) {
      log('✅ Table exists', 'green');
    } else {
      log('❌ Table not found', 'red');
      throw new Error('Table creation verification failed');
    }

    // Count records
    const countResult = await client.query('SELECT COUNT(*) as count FROM problem_grid_mappings');
    const recordCount = countResult.rows[0].count;
    log(`✅ Records inserted: ${recordCount}`, 'green');

    // Show sample data
    console.log('');
    log('📊 Sample Data:', 'blue');
    const sampleData = await client.query(`
      SELECT problem_id, problem_name, role_id, order_index 
      FROM problem_grid_mappings 
      ORDER BY order_index 
      LIMIT 5;
    `);
    console.table(sampleData.rows);

    console.log('');
    log('╔════════════════════════════════════════════════════════════╗', 'green');
    log('║   ✅ DATABASE MIGRATION COMPLETE                          ║', 'green');
    log('╚════════════════════════════════════════════════════════════╝', 'green');
    console.log('');
    log('Next Steps:', 'blue');
    log('  1. Test API endpoint: /customer/vendors/by-problem', 'blue');
    log('  2. Test in browser: Navigate to problem grid', 'blue');
    log('  3. Verify vendors appear for selected problems', 'blue');
    console.log('');

  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run migration
executeMigration().catch(console.error);
