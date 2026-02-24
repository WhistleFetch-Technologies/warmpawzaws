const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const fs = require('fs');
const path = require('path');

const REGION = 'ap-south-1';
const CLUSTER_ARN = 'arn:aws:rds:ap-south-1:057442119249:cluster:warmpawz-prod-cluster';
const SECRET_ARN = 'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-prod-rds-master-20260207201049162400000001-hmqkCE';
const DB_NAME = 'warmpawz';

const MIGRATION_FILE = path.join(__dirname, '..', 'db', 'migrations', '604_make_events_vendor_id_nullable.sql');

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
  console.log('MIGRATION 604: Make events vendor_id nullable (PROD)');
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
      
      if (result.error.includes('already exists') || result.error.includes('duplicate') || result.error.includes('does not exist') || result.error.includes('column') && result.error.includes('already')) {
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
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'vendor_id'
  `);

  if (verifyResult.success && verifyResult.response.records && verifyResult.response.records.length > 0) {
    console.log('✅ Column vendor_id exists in events table');
    const col = verifyResult.response.records[0];
    console.log(`   Data type: ${col[1]?.stringValue || 'unknown'}`);
    console.log(`   Nullable: ${col[2]?.stringValue || 'unknown'}`);
    if (col[2]?.stringValue === 'YES') {
      console.log('   ✅ Column is now nullable');
    } else {
      console.log('   ⚠️  Column is still NOT NULL');
    }
  } else {
    console.log('❌ Column vendor_id NOT found in events table');
  }

  // Check foreign key constraint
  const fkCheck = await executeStatement(client, `
    SELECT conname, pg_get_constraintdef(oid) as constraint_def
    FROM pg_constraint
    WHERE conrelid = 'events'::regclass
      AND conname = 'events_vendor_id_fkey'
  `);

  if (fkCheck.success && fkCheck.response.records && fkCheck.response.records.length > 0) {
    console.log('✅ Foreign key constraint events_vendor_id_fkey exists');
    const fkDef = fkCheck.response.records[0][1]?.stringValue || 'unknown';
    console.log(`   Definition: ${fkDef}`);
  } else {
    console.log('⚠️  Foreign key constraint events_vendor_id_fkey NOT found');
  }

  console.log('\n============================================================================');
  if (errorCount === 0) {
    console.log('✅ MIGRATION 604 COMPLETED SUCCESSFULLY (PROD)');
  } else {
    console.log('⚠️  MIGRATION 604 COMPLETED WITH ERRORS (PROD)');
  }
  console.log('============================================================================\n');
}

runMigration().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
