#!/usr/bin/env node
/**
 * Invoke a Lambda function to run database migration
 * This Lambda runs inside the VPC and can access RDS
 */

const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const fs = require('fs');
const path = require('path');

const REGION = 'ap-south-1';
const LAMBDA_FUNCTION_NAME = 'warmpawz-prod-api-handler';

async function runMigrationViaLambda() {
  console.log('🚀 Running otp_tokens migration via Lambda...');
  console.log('');
  
  const lambdaClient = new LambdaClient({ region: REGION });
  
  // Read the migration SQL
  const migrationPath = path.join(__dirname, 'ensure-otp-tokens-table-prod.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  // Create a temporary endpoint to run the migration
  // We'll invoke the Lambda with a special event
  const event = {
    path: '/admin/run-migration',
    httpMethod: 'POST',
    body: JSON.stringify({
      migration: 'ensure-otp-tokens-table-prod',
      sql: migrationSQL
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  try {
    console.log('📤 Invoking Lambda to run migration...');
    const command = new InvokeCommand({
      FunctionName: LAMBDA_FUNCTION_NAME,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify(event)
    });
    
    const response = await lambdaClient.send(command);
    const result = JSON.parse(Buffer.from(response.Payload).toString());
    
    if (result.errorMessage) {
      console.error('❌ Migration failed:', result.errorMessage);
      if (result.stackTrace) {
        console.error(result.stackTrace);
      }
      process.exit(1);
    }
    
    console.log('✅ Migration completed successfully');
    console.log(result);
    
  } catch (error) {
    console.error('❌ Error invoking Lambda:', error.message);
    process.exit(1);
  }
}

// Actually, let's use a simpler approach - create a migration endpoint
// For now, let's just test the verify-otp endpoint first
console.log('Note: This script would require a migration endpoint in the Lambda.');
console.log('Let\'s test the verify-otp endpoint first to see the actual error.');
