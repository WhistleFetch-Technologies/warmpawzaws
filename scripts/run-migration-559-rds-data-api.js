#!/usr/bin/env node
/**
 * Run Migration 559 via RDS Data API
 * Uses RDS HTTP endpoint (Data API) which may work from outside VPC
 */

const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');

const ENVIRONMENT = process.env.ENVIRONMENT || 'prod';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function runMigration() {
  console.log('🚀 Migration 559: Add specializations Column (via RDS Data API)');
  console.log('===============================================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  try {
    // Get RDS cluster info
    const { execSync } = require('child_process');
    const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
    
    console.log('📊 Getting RDS cluster information...');
    const clusterInfo = JSON.parse(execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    ));
    
    if (!clusterInfo.DBClusters || clusterInfo.DBClusters.length === 0) {
      throw new Error(`RDS cluster not found: ${clusterId}`);
    }
    
    const cluster = clusterInfo.DBClusters[0];
    const dbName = cluster.DatabaseName || 'warmpawz';
    const resourceArn = cluster.DBClusterArn;
    
    // Get secret ARN
    const secretName = ENVIRONMENT === 'prod' 
      ? 'warmpawz-prod-rds-master-20260207201049162400000001'
      : `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
    
    console.log('🔐 Getting database credentials...');
    const secretsClient = new SecretsManagerClient({ region: REGION });
    const secretValue = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );
    
    const secret = JSON.parse(secretValue.SecretString);
    const secretArn = secretValue.ARN;
    
    console.log('✅ Credentials retrieved');
    console.log(`   Resource ARN: ${resourceArn}`);
    console.log(`   Secret ARN: ${secretArn}`);
    console.log('');

    // Read migration file
    const migrationFile = '559_add_vendors_specializations_column.sql';
    const migrationPath = path.join(__dirname, '..', 'db', 'migrations', migrationFile);
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('📄 Migration file loaded');
    console.log('');

    // Initialize RDS Data API client
    const rdsDataClient = new RDSDataClient({ region: REGION });
    
    // Split SQL into individual statements (RDS Data API executes one at a time)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));
    
    console.log(`⚙️  Executing ${statements.length} SQL statements...`);
    console.log('─────────────────────────────────────────');
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement || statement.length < 10) continue; // Skip very short statements
      
      try {
        console.log(`[${i + 1}/${statements.length}] Executing statement...`);
        
        const command = new ExecuteStatementCommand({
          resourceArn: resourceArn,
          secretArn: secretArn,
          database: dbName,
          sql: statement,
        });
        
        const response = await rdsDataClient.send(command);
        console.log(`   ✅ Statement executed successfully`);
        
        if (response.records && response.records.length > 0) {
          console.log(`   📊 Records returned: ${response.records.length}`);
        }
      } catch (error) {
        // Some statements might fail if objects already exist (idempotent)
        if (error.message && (
          error.message.includes('already exists') ||
          error.message.includes('duplicate') ||
          error.message.includes('IF NOT EXISTS')
        )) {
          console.log(`   ⚠️  Statement skipped (already exists): ${error.message.substring(0, 50)}...`);
        } else {
          throw error;
        }
      }
    }
    
    console.log('');
    console.log('✅ Migration completed!');
    console.log('');
    
    // Verify
    console.log('🔍 Verifying migration...');
    const verifyCommand = new ExecuteStatementCommand({
      resourceArn: resourceArn,
      secretArn: secretArn,
      database: dbName,
      sql: `
        SELECT column_name, data_type, column_default 
        FROM information_schema.columns 
        WHERE table_name = 'vendors' AND column_name = 'specializations';
      `,
    });
    
    const verifyResponse = await rdsDataClient.send(verifyCommand);
    
    if (verifyResponse.records && verifyResponse.records.length > 0) {
      console.log('✅ Column verified:');
      const record = verifyResponse.records[0];
      console.log(`   Column: ${record[0].stringValue}`);
      console.log(`   Type: ${record[1].stringValue}`);
      console.log(`   Default: ${record[2].stringValue || 'NULL'}`);
    } else {
      console.log('⚠️  Column not found - migration may have failed');
    }
    
    console.log('');
    console.log('🎉 Migration 559 completed successfully!');
    
  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:');
    console.error(error.message);
    
    if (error.message.includes('AccessDenied') || error.message.includes('Forbidden')) {
      console.log('');
      console.log('💡 This might require VPC access. Try:');
      console.log('   1. AWS CloudShell (if VPC access configured)');
      console.log('   2. EC2 instance in the VPC via Systems Manager');
      console.log('   3. Or use: ./scripts/run-migration-559-prod.sh');
    }
    
    process.exit(1);
  }
}

runMigration();
