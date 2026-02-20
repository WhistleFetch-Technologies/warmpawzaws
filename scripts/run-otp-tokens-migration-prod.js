#!/usr/bin/env node
/**
 * Run otp_tokens table migration in production using RDS Data API
 * This works from outside the VPC
 */

const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');

const REGION = 'ap-south-1';
const CLUSTER_ARN = 'arn:aws:rds:ap-south-1:057442119249:cluster:warmpawz-prod-cluster';
const SECRET_ARN = 'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-prod-rds-master-20260207201049162400000001-hmqkCE';
const DATABASE = 'warmpawz';

async function runMigration() {
  console.log('🚀 Running otp_tokens table migration in production...');
  console.log('');
  
  const rdsDataClient = new RDSDataClient({ region: REGION });
  
  const migrationSQL = `
    -- Create table if it doesn't exist
    CREATE TABLE IF NOT EXISTS otp_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      phone TEXT NOT NULL,
      email TEXT,
      code TEXT NOT NULL,
      purpose TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      is_used BOOLEAN DEFAULT false,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Add email column if missing
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'otp_tokens' AND column_name = 'email') THEN
        ALTER TABLE otp_tokens ADD COLUMN email TEXT;
      END IF;
    END $$;

    -- Add used_at column if missing
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'otp_tokens' AND column_name = 'used_at') THEN
        ALTER TABLE otp_tokens ADD COLUMN used_at TIMESTAMPTZ;
      END IF;
    END $$;

    -- Create indexes if they don't exist
    CREATE INDEX IF NOT EXISTS idx_otp_tokens_phone ON otp_tokens(phone);
    CREATE INDEX IF NOT EXISTS idx_otp_tokens_code ON otp_tokens(code);
    CREATE INDEX IF NOT EXISTS idx_otp_tokens_expires ON otp_tokens(expires_at);
    CREATE INDEX IF NOT EXISTS idx_otp_tokens_phone_code ON otp_tokens(phone, code) WHERE is_used = false;
  `;
  
  // Split SQL into individual statements (RDS Data API requires one statement at a time)
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  try {
    for (const statement of statements) {
      if (statement.length === 0) continue;
      
      console.log(`Executing: ${statement.substring(0, 60)}...`);
      
      const command = new ExecuteStatementCommand({
        resourceArn: CLUSTER_ARN,
        secretArn: SECRET_ARN,
        database: DATABASE,
        sql: statement
      });
      
      const response = await rdsDataClient.send(command);
      console.log('   ✅ Success');
    }
    
    // Verify table exists
    console.log('');
    console.log('🔍 Verifying table...');
    const verifyCommand = new ExecuteStatementCommand({
      resourceArn: CLUSTER_ARN,
      secretArn: SECRET_ARN,
      database: DATABASE,
      sql: `SELECT COUNT(*) as count FROM otp_tokens WHERE is_used = false;`
    });
    
    const verifyResponse = await rdsDataClient.send(verifyCommand);
    const count = verifyResponse.records[0][0].longValue;
    console.log(`✅ Table verified. Unused OTPs: ${count}`);
    
    console.log('');
    console.log('✅ Migration complete!');
    
  } catch (error) {
    console.error('❌ Error running migration:', error.message);
    if (error.message.includes('does not exist')) {
      console.error('   This might mean the table already exists or there was a syntax error.');
    }
    throw error;
  }
}

runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
