#!/usr/bin/env node

/**
 * Run DB migration via AWS RDS Data API
 * This works if RDS Data API is enabled on the cluster
 *
 * Usage:
 *   ENVIRONMENT=dev node scripts/run-migration-via-rds-data-api.js 538_bookings_cancelled_by_penalty_processed.sql
 *   ENVIRONMENT=dev node scripts/run-migration-via-rds-data-api.js db/migrations/538_bookings_cancelled_by_penalty_processed.sql
 */

let RDSDataClient;
let ExecuteStatementCommand;
let BeginTransactionCommand;
let CommitTransactionCommand;
let useAwsCli = false;
try {
  ({ RDSDataClient, ExecuteStatementCommand, BeginTransactionCommand, CommitTransactionCommand } = require('@aws-sdk/client-rds-data'));
} catch (err) {
  useAwsCli = true;
}
const fs = require('fs');
const { join } = require('path');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function main() {
  console.log('🚀 Running DB Migration via RDS Data API...\n');

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
    let secretArn = clusterInfo.DBClusters[0].MasterUserSecret?.SecretArn;
    if (!secretArn) {
      const secretName = ENVIRONMENT === 'prod'
        ? 'warmpawz-prod-rds-master-20260207201049162400000001'
        : `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
      const describeSecret = JSON.parse(execSync(
        `aws secretsmanager describe-secret --secret-id "${secretName}" --region ${REGION} --output json`,
        { encoding: 'utf8' }
      ));
      secretArn = describeSecret.ARN;
    }

    console.log('✅ Cluster found:');
    console.log(`   ARN: ${clusterArn}`);
    console.log(`   Database: ${dbName}`);
    console.log(`   Secret ARN: ${secretArn}\n`);

    // Check if Data API is enabled
    if (!clusterInfo.DBClusters[0].HttpEndpointEnabled) {
      throw new Error('RDS Data API is not enabled on this cluster. Enable it in RDS console or use Query Editor.');
    }

    // Create RDS Data API client (fallback to AWS CLI if SDK not installed)
    const client = useAwsCli ? null : new RDSDataClient({ region: REGION });
    const runAwsCli = (args) => {
      const { execFileSync } = require('child_process');
      const output = execFileSync('aws', args, { encoding: 'utf8' });
      return output ? JSON.parse(output) : {};
    };

    // Read migration file
    const arg = process.argv[2];
    const migrationFile = (() => {
      if (!arg) return null;
      if (arg.startsWith('/') || arg.startsWith('./') || arg.startsWith('../')) {
        return join(process.cwd(), arg);
      }
      if (arg.startsWith('db/')) {
        return join(__dirname, '..', arg);
      }
      return join(__dirname, '..', 'db', 'migrations', arg);
    })();

    if (!migrationFile) {
      throw new Error('Migration file argument is required (e.g. 538_bookings_cancelled_by_penalty_processed.sql)');
    }

    if (!fs.existsSync(migrationFile)) {
      throw new Error(`Migration file not found: ${migrationFile}`);
    }

    const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

    console.log(`📁 Migration file loaded: ${migrationFile}\n`);
    console.log('🔄 Executing migration...\n');

    // Strip comments first so semicolons inside comments don't break statement splitting
    const stripped = migrationSQL
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');

    // Split SQL into individual statements
    const statements = stripped
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 10);

    // Begin transaction
    let transactionId;
    if (useAwsCli) {
      const beginTx = runAwsCli([
        'rds-data',
        'begin-transaction',
        '--resource-arn',
        clusterArn,
        '--secret-arn',
        secretArn,
        '--database',
        dbName,
        '--region',
        REGION
      ]);
      transactionId = beginTx.transactionId;
    } else {
      const beginTx = await client.send(new BeginTransactionCommand({
        resourceArn: clusterArn,
        secretArn: secretArn,
        database: dbName
      }));
      transactionId = beginTx.transactionId;
    }
    console.log('✅ Transaction started\n');

    let successCount = 0;
    let errorCount = 0;

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length < 10) continue; // Skip very short statements

      try {
        if (useAwsCli) {
          runAwsCli([
            'rds-data',
            'execute-statement',
            '--resource-arn',
            clusterArn,
            '--secret-arn',
            secretArn,
            '--database',
            dbName,
            '--sql',
            statement,
            '--transaction-id',
            transactionId,
            '--region',
            REGION
          ]);
        } else {
          await client.send(new ExecuteStatementCommand({
            resourceArn: clusterArn,
            secretArn: secretArn,
            database: dbName,
            sql: statement,
            transactionId: transactionId
          }));
        }
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
    if (useAwsCli) {
      runAwsCli([
        'rds-data',
        'commit-transaction',
        '--resource-arn',
        clusterArn,
        '--secret-arn',
        secretArn,
        '--transaction-id',
        transactionId,
        '--region',
        REGION
      ]);
    } else {
      await client.send(new CommitTransactionCommand({
        resourceArn: clusterArn,
        secretArn: secretArn,
        transactionId: transactionId
      }));
    }

    console.log('✅ Transaction committed\n');
    console.log(`📊 Results: ${successCount} successful, ${errorCount} errors\n`);

    // Verify migration (basic checks for known migrations)
    const migrationBase = migrationFile.split('/').pop() || '';
    if (migrationBase.includes('553')) {
      console.log('🔍 Verifying migration 553 (package_purchases.package_snapshot + index)...');
      const colSql = `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'package_purchases' AND column_name = 'package_snapshot'`;
      const colResult = useAwsCli
        ? runAwsCli(['rds-data', 'execute-statement', '--resource-arn', clusterArn, '--secret-arn', secretArn, '--database', dbName, '--sql', colSql, '--format-records-as', 'JSON', '--region', REGION])
        : await client.send(new ExecuteStatementCommand({ resourceArn: clusterArn, secretArn: secretArn, database: dbName, sql: colSql, formatRecordsAs: 'JSON' }));
      const colRows = colResult.formattedRecords
        ? JSON.parse(colResult.formattedRecords).map((r) => ({ name: r.column_name, type: r.data_type }))
        : (colResult.records || []).map((r) => ({ name: r[0]?.stringValue, type: r[1]?.stringValue }));
      if (colRows.length === 0) {
        throw new Error('Verification failed: column package_purchases.package_snapshot not found');
      }
      console.log(`   ✅ Column: ${colRows[0].name} (${colRows[0].type})`);
      const idxSql = `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'package_purchases' AND indexname = 'idx_package_purchases_customer_vendor_active'`;
      const idxResult = useAwsCli
        ? runAwsCli(['rds-data', 'execute-statement', '--resource-arn', clusterArn, '--secret-arn', secretArn, '--database', dbName, '--sql', idxSql, '--format-records-as', 'JSON', '--region', REGION])
        : await client.send(new ExecuteStatementCommand({ resourceArn: clusterArn, secretArn: secretArn, database: dbName, sql: idxSql, formatRecordsAs: 'JSON' }));
      const idxRows = idxResult.formattedRecords
        ? JSON.parse(idxResult.formattedRecords).map((r) => r.indexname).filter(Boolean)
        : (idxResult.records || []).map((r) => r[0]?.stringValue).filter(Boolean);
      if (idxRows.length === 0) {
        throw new Error('Verification failed: index idx_package_purchases_customer_vendor_active not found');
      }
      console.log(`   ✅ Index: ${idxRows[0]}`);
    } else if (migrationBase.includes('538')) {
      console.log('🔍 Verifying migration 538 (bookings.cancelled_by, penalty_processed)...');
      const verifySql = `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'bookings'
            AND column_name IN ('cancelled_by', 'penalty_processed')
          ORDER BY column_name;
        `;
      const verifyResult = useAwsCli
        ? runAwsCli([
            'rds-data',
            'execute-statement',
            '--resource-arn',
            clusterArn,
            '--secret-arn',
            secretArn,
            '--database',
            dbName,
            '--sql',
            verifySql,
            '--format-records-as',
            'JSON',
            '--region',
            REGION
          ])
        : await client.send(new ExecuteStatementCommand({
            resourceArn: clusterArn,
            secretArn: secretArn,
            database: dbName,
            sql: verifySql,
            formatRecordsAs: 'JSON'
          }));
      const cols = (verifyResult.records || []).map(r => r[0]?.stringValue).filter(Boolean);
      if (cols.includes('cancelled_by') && cols.includes('penalty_processed')) {
        console.log('✅ Columns verified:', cols.join(', '));
      } else {
        console.log('⚠️  Columns not fully verified. Found:', cols.join(', ') || 'none');
      }
    } else {
      console.log('✅ Migration executed (no specific verification configured).');
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
