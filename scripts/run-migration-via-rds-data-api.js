#!/usr/bin/env node

/**
 * Run Instant Tele Queue Migration via AWS RDS Data API
 * This works if RDS Data API is enabled on the cluster
 */

const { RDSDataClient, ExecuteStatementCommand, BeginTransactionCommand, CommitTransactionCommand } = require('@aws-sdk/client-rds-data');
const fs = require('fs');
const { join } = require('path');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function main() {
  console.log('🚀 Running Instant Tele Queue Migration via RDS Data API...\n');

  try {
    // Get cluster ARN and database name
    console.log('📊 Getting RDS cluster information...');
    const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
    
    const clusterInfo = JSON.parse(execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    ));

    const clusterArn = clusterInfo.DBClusters[0].DBClusterArn;
    const dbName = clusterInfo.DBClusters[0].DatabaseName || 'warmpawz';
    const secretArn = clusterInfo.DBClusters[0].MasterUserSecret?.SecretArn || 
                     `arn:aws:secretsmanager:${REGION}:${process.env.AWS_ACCOUNT_ID || ''}:secret:warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;

    console.log('✅ Cluster found:');
    console.log(`   ARN: ${clusterArn}`);
    console.log(`   Database: ${dbName}`);
    console.log(`   Secret ARN: ${secretArn}\n`);

    // Check if Data API is enabled
    if (!clusterInfo.DBClusters[0].EnableHttpEndpoint) {
      throw new Error('RDS Data API is not enabled on this cluster. Enable it in RDS console or use Query Editor.');
    }

    // Create RDS Data API client
    const client = new RDSDataClient({ region: REGION });

    // Read migration file
    const migrationFile = join(__dirname, '..', 'backend', 'lambda', 'src', 'database', 'schemas', 'instant-tele-queue.sql');
    const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

    console.log('📁 Migration file loaded\n');
    console.log('🔄 Executing migration...\n');

    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

    // Begin transaction
    const beginTx = await client.send(new BeginTransactionCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: dbName
    }));

    const transactionId = beginTx.transactionId;
    console.log('✅ Transaction started\n');

    let successCount = 0;
    let errorCount = 0;

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length < 10) continue; // Skip very short statements

      try {
        await client.send(new ExecuteStatementCommand({
          resourceArn: clusterArn,
          secretArn: secretArn,
          database: dbName,
          sql: statement,
          transactionId: transactionId
        }));
        successCount++;
        process.stdout.write(`   ✅ Statement ${i + 1}/${statements.length}\r`);
      } catch (error) {
        // Some errors are expected (IF NOT EXISTS, etc.)
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          successCount++;
          process.stdout.write(`   ⚠️  Statement ${i + 1}/${statements.length} (already exists)\r`);
        } else {
          errorCount++;
          console.error(`\n   ❌ Error in statement ${i + 1}: ${error.message}`);
          console.error(`   SQL: ${statement.substring(0, 100)}...`);
        }
      }
    }

    console.log('\n');

    // Commit transaction
    await client.send(new CommitTransactionCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      transactionId: transactionId
    }));

    console.log('✅ Transaction committed\n');
    console.log(`📊 Results: ${successCount} successful, ${errorCount} errors\n`);

    // Verify tables
    console.log('🔍 Verifying tables...');
    const verifyResult = await client.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: dbName,
      sql: `
        SELECT 
          table_name,
          (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count,
          (SELECT COUNT(*) FROM information_schema.indexes WHERE tablename = t.table_name) as index_count
        FROM information_schema.tables t
        WHERE table_schema = 'public' 
          AND table_name IN ('staff_tele_availability', 'tele_queue')
        ORDER BY table_name;
      `,
      formatRecordsAs: 'JSON'
    }));

    if (verifyResult.records && verifyResult.records.length > 0) {
      console.log('✅ Tables created:');
      verifyResult.records.forEach(record => {
        const tableName = record[0].stringValue;
        const columns = record[1].longValue;
        const indexes = record[2].longValue;
        console.log(`   - ${tableName}: ${columns} columns, ${indexes} indexes`);
      });
    } else {
      console.log('⚠️  Tables not found - migration may have failed');
    }

    console.log('\n✅ Migration complete!\n');

  } catch (error) {
    if (error.message.includes('not enabled')) {
      console.error('\n❌ RDS Data API is not enabled.');
      console.error('\n💡 Solutions:');
      console.error('   1. Enable Data API in RDS Console:');
      console.error('      - Go to RDS → Databases → Your cluster → Configuration');
      console.error('      - Enable "Data API"');
      console.error('   2. OR use AWS RDS Query Editor (recommended):');
      console.error('      - Go to RDS → Query Editor');
      console.error('      - Connect and run MIGRATION_SQL_TO_COPY.sql');
    } else {
      console.error('\n❌ Migration failed:', error.message);
    }
    process.exit(1);
  }
}

main();
