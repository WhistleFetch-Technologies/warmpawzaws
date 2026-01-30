#!/usr/bin/env node
/**
 * Run KYC Verification Schema Migration (504) on AWS RDS
 * Simple version - executes entire SQL file as one transaction
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function runMigration() {
  console.log('🚀 KYC Verification Schema Migration (504) - AWS RDS');
  console.log('=====================================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  const { execSync } = require('child_process');
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;

  console.log('📊 Getting RDS cluster information...');
  
  let endpoint, port, dbName, username;
  
  try {
    endpoint = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
      { encoding: 'utf8' }
    ).trim();

    port = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Port' --output text`,
      { encoding: 'utf8' }
    ).trim() || '5432';

    dbName = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].DatabaseName' --output text`,
      { encoding: 'utf8' }
    ).trim() || 'warmpawz';

    username = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].MasterUsername' --output text`,
      { encoding: 'utf8' }
    ).trim() || 'warmpawz_admin';
  } catch (err) {
    console.error('❌ ERROR: Failed to get RDS cluster info:', err.message);
    process.exit(1);
  }

  console.log(`   Endpoint: ${endpoint}:${port}/${dbName}`);

  // Get password from Secrets Manager
  console.log('🔐 Getting credentials...');
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  
  let password;
  try {
    const secretValue = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );
    const secret = JSON.parse(secretValue.SecretString);
    password = secret.password || secret.Password;
  } catch (err) {
    console.error('❌ ERROR: Could not get password:', err.message);
    process.exit(1);
  }

  console.log('✅ Credentials retrieved');

  // Connect to database
  const pool = new Pool({
    host: endpoint,
    port: parseInt(port, 10),
    database: dbName,
    user: username,
    password: password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  try {
    await pool.query('SELECT 1');
    console.log('✅ Connected to database');
    console.log('');

    // Execute each table creation separately
    console.log('🔧 Creating vendor_kyc_verifications table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendor_kyc_verifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
        aadhaar_number_masked TEXT,
        aadhaar_verified BOOLEAN DEFAULT false,
        aadhaar_verified_at TIMESTAMPTZ,
        aadhaar_verification_id TEXT,
        aadhaar_name TEXT,
        aadhaar_verification_response JSONB,
        pan_number TEXT,
        pan_verified BOOLEAN DEFAULT false,
        pan_verified_at TIMESTAMPTZ,
        pan_status TEXT CHECK (pan_status IN ('active', 'inactive', 'unknown')),
        pan_name TEXT,
        pan_name_match_score DECIMAL(5,2),
        pan_verification_response JSONB,
        gstin TEXT,
        gstin_verified BOOLEAN DEFAULT false,
        gstin_verified_at TIMESTAMPTZ,
        gstin_status TEXT CHECK (gstin_status IN ('Active', 'Cancelled', 'Suspended', 'unknown')),
        gstin_legal_name TEXT,
        gstin_trade_name TEXT,
        gstin_state_code TEXT,
        gstin_verification_response JSONB,
        police_verification_status TEXT DEFAULT 'not_submitted' 
          CHECK (police_verification_status IN ('not_submitted', 'submitted', 'pending', 'verified', 'rejected', 'expired')),
        police_verification_doc_url TEXT,
        police_verification_expiry DATE,
        police_verification_notes TEXT,
        police_verified_by UUID,
        police_verified_at TIMESTAMPTZ,
        professional_reg_number TEXT,
        professional_reg_type TEXT,
        professional_reg_verified BOOLEAN DEFAULT false,
        professional_reg_verified_at TIMESTAMPTZ,
        professional_reg_expiry DATE,
        professional_reg_notes TEXT,
        awbi_registration TEXT,
        awbi_verified BOOLEAN DEFAULT false,
        awbi_verified_at TIMESTAMPTZ,
        awbi_expiry DATE,
        kyc_status TEXT DEFAULT 'pending' 
          CHECK (kyc_status IN ('pending', 'partial', 'complete', 'expired', 'rejected', 'under_review')),
        kyc_score INTEGER DEFAULT 0 CHECK (kyc_score >= 0 AND kyc_score <= 100),
        kyc_completed_at TIMESTAMPTZ,
        kyc_reviewed_by UUID,
        kyc_review_notes TEXT,
        is_soft_blocked BOOLEAN DEFAULT false,
        soft_block_reason TEXT,
        soft_block_fields TEXT[],
        requires_annual_revalidation BOOLEAN DEFAULT false,
        last_revalidation_date DATE,
        next_revalidation_due DATE,
        revalidation_reminder_sent BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(vendor_id)
      )
    `);
    console.log('   ✅ vendor_kyc_verifications created');

    // Create indexes
    console.log('🔧 Creating indexes...');
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_vendor_kyc_vendor_id ON vendor_kyc_verifications(vendor_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_vendor_kyc_status ON vendor_kyc_verifications(kyc_status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_vendor_kyc_aadhaar_verified ON vendor_kyc_verifications(aadhaar_verified)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_vendor_kyc_pan_verified ON vendor_kyc_verifications(pan_verified)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_vendor_kyc_gstin_verified ON vendor_kyc_verifications(gstin_verified)`);
    console.log('   ✅ Indexes created');

    console.log('🔧 Creating vendor_declarations table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendor_declarations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
        declaration_type TEXT NOT NULL,
        declaration_text TEXT NOT NULL,
        accepted BOOLEAN DEFAULT false,
        accepted_at TIMESTAMPTZ,
        ip_address TEXT,
        user_agent TEXT,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(vendor_id, declaration_type)
      )
    `);
    console.log('   ✅ vendor_declarations created');

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_vendor_declarations_vendor_id ON vendor_declarations(vendor_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_vendor_declarations_type ON vendor_declarations(declaration_type)`);
    console.log('   ✅ Declaration indexes created');

    console.log('🔧 Creating kyc_verification_audit_log table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS kyc_verification_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
        verification_type TEXT NOT NULL,
        action TEXT NOT NULL,
        request_data JSONB,
        response_data JSONB,
        provider TEXT,
        provider_reference_id TEXT,
        success BOOLEAN DEFAULT false,
        error_message TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('   ✅ kyc_verification_audit_log created');

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_kyc_audit_vendor_id ON kyc_verification_audit_log(vendor_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_kyc_audit_type ON kyc_verification_audit_log(verification_type)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_kyc_audit_created_at ON kyc_verification_audit_log(created_at)`);
    console.log('   ✅ Audit log indexes created');

    // Verify tables
    console.log('');
    console.log('🔍 Verifying tables...');
    const tables = ['vendor_kyc_verifications', 'vendor_declarations', 'kyc_verification_audit_log'];
    for (const table of tables) {
      const result = await pool.query(`
        SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)
      `, [table]);
      console.log(`   ${result.rows[0].exists ? '✅' : '❌'} ${table}`);
    }

    console.log('');
    console.log('✅ KYC Verification Schema Migration Complete!');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
