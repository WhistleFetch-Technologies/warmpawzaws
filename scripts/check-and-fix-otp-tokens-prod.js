#!/usr/bin/env node
/**
 * Check and fix otp_tokens table in production database
 * Ensures the table exists with all required columns
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');

const ENVIRONMENT = 'prod';
const REGION = 'ap-south-1';

async function getDbCredentials() {
  const secretsClient = new SecretsManagerClient({ region: REGION });
  
  // Get secret ARN from environment or use default pattern
  const secretArn = process.env.DB_SECRET_ARN || `arn:aws:secretsmanager:${REGION}:057442119249:secret:warmpawz-prod-rds-master-*`;
  
  console.log('🔐 Getting database credentials from Secrets Manager...');
  
  try {
    // List secrets to find the exact ARN
    const { execSync } = require('child_process');
    const secretsList = JSON.parse(execSync(
      `aws secretsmanager list-secrets --region ${REGION} --filters Key=name,Values=warmpawz-prod-rds-master --output json`,
      { encoding: 'utf8' }
    ));
    
    if (!secretsList.SecretList || secretsList.SecretList.length === 0) {
      throw new Error('Database secret not found');
    }
    
    const secretArn = secretsList.SecretList[0].ARN;
    console.log(`   Found secret: ${secretArn}`);
    
    const command = new GetSecretValueCommand({ SecretId: secretArn });
    const response = await secretsClient.send(command);
    const secret = JSON.parse(response.SecretString);
    
    return {
      host: process.env.DB_HOST || 'warmpawz-prod-proxy.proxy-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
      port: 5432,
      database: process.env.DB_NAME || 'warmpawz',
      user: secret.username || 'warmpawz_admin',
      password: secret.password,
      ssl: { rejectUnauthorized: false }
    };
  } catch (error) {
    console.error('❌ Error getting credentials:', error.message);
    throw error;
  }
}

async function checkAndFixOtpTokens() {
  console.log('🔍 Checking otp_tokens table in production...');
  console.log('');
  
  let pool;
  try {
    const credentials = await getDbCredentials();
    pool = new Pool(credentials);
    
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Connected to database');
    console.log('');
    
    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'otp_tokens'
      );
    `);
    
    const tableExists = tableCheck.rows[0].exists;
    
    if (!tableExists) {
      console.log('❌ otp_tokens table does not exist. Creating...');
      await pool.query(`
        CREATE TABLE otp_tokens (
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
      `);
      console.log('✅ otp_tokens table created');
    } else {
      console.log('✅ otp_tokens table exists');
    }
    
    // Check columns
    console.log('');
    console.log('🔍 Checking columns...');
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'otp_tokens'
      ORDER BY ordinal_position;
    `);
    
    const requiredColumns = ['id', 'phone', 'code', 'purpose', 'expires_at', 'is_used', 'used_at', 'created_at'];
    const existingColumns = columns.rows.map(r => r.column_name);
    
    console.log('   Existing columns:', existingColumns.join(', '));
    
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length > 0) {
      console.log(`❌ Missing columns: ${missingColumns.join(', ')}`);
      
      // Add missing columns
      for (const col of missingColumns) {
        let alterSql = '';
        switch (col) {
          case 'email':
            alterSql = 'ALTER TABLE otp_tokens ADD COLUMN IF NOT EXISTS email TEXT;';
            break;
          case 'used_at':
            alterSql = 'ALTER TABLE otp_tokens ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;';
            break;
          default:
            console.log(`   ⚠️  Cannot auto-add column: ${col}`);
            continue;
        }
        
        if (alterSql) {
          await pool.query(alterSql);
          console.log(`   ✅ Added column: ${col}`);
        }
      }
    } else {
      console.log('✅ All required columns exist');
    }
    
    // Check indexes
    console.log('');
    console.log('🔍 Checking indexes...');
    const indexes = await pool.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'otp_tokens';
    `);
    
    const existingIndexes = indexes.rows.map(r => r.indexname);
    console.log('   Existing indexes:', existingIndexes.length > 0 ? existingIndexes.join(', ') : 'none');
    
    // Create indexes if missing
    const requiredIndexes = [
      { name: 'idx_otp_tokens_phone', sql: 'CREATE INDEX IF NOT EXISTS idx_otp_tokens_phone ON otp_tokens(phone);' },
      { name: 'idx_otp_tokens_code', sql: 'CREATE INDEX IF NOT EXISTS idx_otp_tokens_code ON otp_tokens(code);' },
      { name: 'idx_otp_tokens_expires', sql: 'CREATE INDEX IF NOT EXISTS idx_otp_tokens_expires ON otp_tokens(expires_at);' }
    ];
    
    for (const idx of requiredIndexes) {
      if (!existingIndexes.includes(idx.name)) {
        await pool.query(idx.sql);
        console.log(`   ✅ Created index: ${idx.name}`);
      }
    }
    
    // Test query
    console.log('');
    console.log('🧪 Testing otp_tokens table...');
    const testQuery = await pool.query(`
      SELECT COUNT(*) as count FROM otp_tokens WHERE is_used = false;
    `);
    console.log(`   ✅ Query successful. Unused OTPs: ${testQuery.rows[0].count}`);
    
    console.log('');
    console.log('✅ otp_tokens table is ready!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Run the check
checkAndFixOtpTokens().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
