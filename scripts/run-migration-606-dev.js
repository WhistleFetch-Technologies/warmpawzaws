const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REGION = 'ap-south-1';
const ENVIRONMENT = 'dev';

// Get dev cluster info
let CLUSTER_ARN, SECRET_ARN, DB_NAME;

try {
  console.log('📊 Getting dev RDS cluster information...');
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  
  const clusterInfo = JSON.parse(execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
    { encoding: 'utf8' }
  ));

  CLUSTER_ARN = clusterInfo.DBClusters[0].DBClusterArn;
  DB_NAME = clusterInfo.DBClusters[0].DatabaseName || 'warmpawz';
  
  // Get secret ARN
  let secretArn = clusterInfo.DBClusters[0].MasterUserSecret?.SecretArn;
  if (!secretArn) {
    const secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
    try {
      const describeSecret = JSON.parse(execSync(
        `aws secretsmanager describe-secret --secret-id "${secretName}" --region ${REGION} --output json`,
        { encoding: 'utf8' }
      ));
      secretArn = describeSecret.ARN;
    } catch (err) {
      console.error('❌ Could not find secret:', err.message);
      process.exit(1);
    }
  }
  SECRET_ARN = secretArn;

  console.log('✅ Dev cluster found:');
  console.log(`   ARN: ${CLUSTER_ARN}`);
  console.log(`   Database: ${DB_NAME}`);
  console.log(`   Secret ARN: ${SECRET_ARN}\n`);
} catch (error) {
  console.error('❌ Error getting cluster info:', error.message);
  process.exit(1);
}

const MIGRATION_FILE = path.join(__dirname, '..', 'db', 'migrations', '606_fix_events_status_constraint.sql');

async function executeStatement(client, sql, params = []) {
  const command = new ExecuteStatementCommand({
    resourceArn: CLUSTER_ARN,
    secretArn: SECRET_ARN,
    database: DB_NAME,
    sql: sql,
    parameters: params.map((p, idx) => ({ 
      name: `param${idx + 1}`, 
      value: { stringValue: String(p) } 
    }))
  });

  try {
    const response = await client.send(command);
    return { success: true, response };
  } catch (error) {
    return { success: false, error: error.message, code: error.code };
  }
}

async function runMigration() {
  console.log('============================================================================');
  console.log('MIGRATION 606: Fix events status check constraint (DEV)');
  console.log('============================================================================\n');

  // Read migration file
  if (!fs.existsSync(MIGRATION_FILE)) {
    console.error(`❌ Migration file not found: ${MIGRATION_FILE}`);
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(MIGRATION_FILE, 'utf8');
  console.log(`✅ Read migration file: ${MIGRATION_FILE}\n`);

  const client = new RDSDataClient({ region: REGION });

  // Split SQL into statements (handle DO $$ blocks)
  const statements = [];
  let cleanSQL = migrationSQL
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');
  
  let currentStatement = '';
  let inDollarQuote = false;
  let dollarTag = '';
  
  for (let i = 0; i < cleanSQL.length; i++) {
    const char = cleanSQL[i];
    const nextChars = cleanSQL.substring(i, Math.min(i + 20, cleanSQL.length));
    
    currentStatement += char;
    
    if (!inDollarQuote && char === '$') {
      if (nextChars.startsWith('$$')) {
        inDollarQuote = true;
        dollarTag = '$$';
        i++;
        currentStatement += '$';
        continue;
      } else if (nextChars.match(/^\$[a-zA-Z_]*\$/)) {
        const match = nextChars.match(/^(\$[a-zA-Z_]*\$)/);
        if (match) {
          inDollarQuote = true;
          dollarTag = match[1];
          i += match[1].length - 1;
          currentStatement += match[1].substring(1);
          continue;
        }
      }
    }
    
    if (inDollarQuote && nextChars.startsWith(dollarTag)) {
      i += dollarTag.length - 1;
      currentStatement += dollarTag.substring(1);
      inDollarQuote = false;
      dollarTag = '';
      continue;
    }
    
    if (char === ';' && !inDollarQuote) {
      const stmt = currentStatement.trim();
      if (stmt) {
        statements.push(stmt);
      }
      currentStatement = '';
    }
  }
  
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }

  console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (!statement || statement.trim() === '') continue;

    console.log(`\n[${i + 1}/${statements.length}] Executing statement...`);
    console.log(`SQL (first 200 chars): ${statement.substring(0, 200)}...`);

    const result = await executeStatement(client, statement);

    if (result.success) {
      console.log(`✅ Statement ${i + 1} executed successfully`);
      successCount++;
    } else {
      console.error(`❌ Statement ${i + 1} failed: ${result.error}`);
      console.error(`   Error code: ${result.code}`);
      errorCount++;
      
      if (result.error.includes('already exists') || result.error.includes('duplicate') || result.error.includes('does not exist')) {
        console.log(`   ⚠️  This appears to be an idempotent error, continuing...`);
      }
    }
  }

  console.log('\n============================================================================');
  console.log('MIGRATION SUMMARY');
  console.log('============================================================================');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log(`📊 Total: ${statements.length}`);

  // Verify migration
  console.log('\n🔍 Verifying migration...');
  const verifyResult = await executeStatement(client, `
    SELECT conname, pg_get_constraintdef(oid) as constraint_def
    FROM pg_constraint
    WHERE conrelid = 'events'::regclass
      AND conname = 'events_status_check'
  `);

  if (verifyResult.success && verifyResult.response.records && verifyResult.response.records.length > 0) {
    console.log('✅ Constraint events_status_check exists');
    const constraintDef = verifyResult.response.records[0][1]?.stringValue || 'unknown';
    console.log(`   Definition: ${constraintDef}`);
  } else {
    console.log('⚠️  Constraint events_status_check NOT found');
  }

  console.log('\n============================================================================');
  if (errorCount === 0) {
    console.log('✅ MIGRATION 606 COMPLETED SUCCESSFULLY (DEV)');
  } else {
    console.log('⚠️  MIGRATION 606 COMPLETED WITH ERRORS (DEV)');
  }
  console.log('============================================================================\n');
}

runMigration().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
