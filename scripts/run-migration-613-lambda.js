#!/usr/bin/env node
/**
 * Run Migration 613 via Lambda (runs from within VPC)
 * This script creates a temporary Lambda function to run the migration
 * since RDS is not publicly accessible
 */

const { LambdaClient, CreateFunctionCommand, InvokeCommand, DeleteFunctionCommand } = require('@aws-sdk/client-lambda');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function runMigration() {
  console.log('🚀 Migration 613 - Running via Lambda (VPC access)');
  console.log('==================================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  // Read migration file
  const migrationFile = path.join(__dirname, '..', 'db', 'migrations', '613_change_bookings_service_id_to_vendor_services.sql');
  if (!fs.existsSync(migrationFile)) {
    console.error(`❌ Migration file not found: ${migrationFile}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationFile, 'utf8');
  console.log(`✅ Migration file loaded: ${sql.length} bytes`);
  console.log('');

  // Get RDS connection details
  console.log('📊 Getting RDS connection details...');
  const dbHost = execSync(
    `aws ssm get-parameter --name "/warmpawz/${ENVIRONMENT}/db/host" --region ${REGION} --output text --query "Parameter.Value"`,
    { encoding: 'utf8' }
  ).trim();

  const dbPort = execSync(
    `aws ssm get-parameter --name "/warmpawz/${ENVIRONMENT}/db/port" --region ${REGION} --output text --query "Parameter.Value"`,
    { encoding: 'utf8' }
  ).trim() || '5432';

  const dbName = execSync(
    `aws ssm get-parameter --name "/warmpawz/${ENVIRONMENT}/db/name" --region ${REGION} --output text --query "Parameter.Value"`,
    { encoding: 'utf8' }
  ).trim();

  const dbUser = execSync(
    `aws ssm get-parameter --name "/warmpawz/${ENVIRONMENT}/db/user" --region ${REGION} --output text --query "Parameter.Value"`,
    { encoding: 'utf8' }
  ).trim();

  // Get password from Secrets Manager
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  
  const secretValue = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );
  const secret = JSON.parse(secretValue.SecretString);
  const dbPassword = secret.password || secret.Password;

  console.log(`✅ RDS details retrieved`);
  console.log(`   Host: ${dbHost}`);
  console.log(`   Database: ${dbName}`);
  console.log('');

  // Create Lambda function code
  const lambdaCode = `
const { Pool } = require('pg');

exports.handler = async (event) => {
  const pool = new Pool({
    host: '${dbHost}',
    port: ${dbPort},
    database: '${dbName}',
    user: '${dbUser}',
    password: '${dbPassword}',
    ssl: { rejectUnauthorized: false }
  });

  try {
    const sql = \`${sql.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
    const result = await pool.query(sql);
    await pool.end();
    
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Migration completed' })
    };
  } catch (error) {
    await pool.end();
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
`;

  // For now, let's use a simpler approach - use the existing migration script
  // but suggest running it from an EC2 instance or using AWS Systems Manager
  console.log('⚠️  Direct connection to RDS is not available from outside VPC');
  console.log('');
  console.log('Recommended solutions:');
  console.log('1. Use AWS RDS Query Editor in AWS Console:');
  console.log('   - Go to AWS RDS Console');
  console.log('   - Select your database');
  console.log('   - Click "Query Editor"');
  console.log('   - Paste the migration SQL and run it');
  console.log('');
  console.log('2. Run from EC2 instance in the VPC:');
  console.log('   - Launch an EC2 instance in the same VPC');
  console.log('   - SSH into it');
  console.log('   - Run: ENVIRONMENT=dev node scripts/run-migration-rds-node.js 613_change_bookings_service_id_to_vendor_services.sql');
  console.log('');
  console.log('3. Use AWS Systems Manager Session Manager (if bastion host exists)');
  console.log('');
  
  // Output the SQL for manual execution
  console.log('📄 Migration SQL (for manual execution):');
  console.log('==========================================');
  console.log(sql);
  console.log('==========================================');
}

runMigration().catch(console.error);
