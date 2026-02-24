const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const REGION = 'ap-south-1';
const CLUSTER_ARN = 'arn:aws:rds:ap-south-1:057442119249:cluster:warmpawz-prod-cluster';
const SECRET_ARN = 'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-prod-rds-master-20260207201049162400000001-hmqkCE';
const DB_NAME = 'warmpawz';

async function query(sql, params = []) {
  const client = new RDSDataClient({ region: REGION });
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
    const rows = response.records?.map(record => {
      const row = {};
      record.forEach((field, idx) => {
        if (field.stringValue !== undefined) row[`col${idx}`] = field.stringValue;
        else if (field.longValue !== undefined) row[`col${idx}`] = Number(field.longValue);
        else if (field.doubleValue !== undefined) row[`col${idx}`] = Number(field.doubleValue);
        else if (field.booleanValue !== undefined) row[`col${idx}`] = field.booleanValue;
        else if (field.isNull) row[`col${idx}`] = null;
        else row[`col${idx}`] = null;
      });
      return row;
    }) || [];
    return { rows };
  } catch (err) {
    return { error: err.message, rows: [] };
  }
}

async function main() {
  console.log('============================================================================');
  console.log('Checking events table structure (PROD)');
  console.log('============================================================================\n');

  // Check if table exists
  const tableExists = await query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'events'
    ) as table_exists
  `);
  
  if (tableExists.rows && tableExists.rows.length > 0 && tableExists.rows[0].col0 === 'true') {
    console.log('✅ events table exists\n');
  } else {
    console.log('❌ events table does NOT exist\n');
    return;
  }

  // Get all columns
  console.log('Table columns:');
  const columns = await query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'events'
    ORDER BY ordinal_position
  `);
  
  if (columns.rows && columns.rows.length > 0) {
    columns.rows.forEach(row => {
      console.log(`  - ${row.col0}: ${row.col1} (nullable: ${row.col2}, default: ${row.col3 || 'NULL'})`);
    });
  } else {
    console.log('  No columns found');
  }

  // Check for vendor_id specifically
  console.log('\nChecking for vendor_id column:');
  const vendorIdCheck = await query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'vendor_id'
  `);
  
  if (vendorIdCheck.rows && vendorIdCheck.rows.length > 0) {
    console.log(`  ✅ vendor_id exists: ${vendorIdCheck.rows[0].col1} (nullable: ${vendorIdCheck.rows[0].col2})`);
  } else {
    console.log('  ❌ vendor_id column does NOT exist');
  }

  // Check constraints
  console.log('\nForeign key constraints on events table:');
  const constraints = await query(`
    SELECT conname, pg_get_constraintdef(oid) as constraint_def
    FROM pg_constraint
    WHERE conrelid = 'events'::regclass
      AND contype = 'f'
  `);
  
  if (constraints.rows && constraints.rows.length > 0) {
    constraints.rows.forEach(row => {
      console.log(`  - ${row.col0}: ${row.col1}`);
    });
  } else {
    console.log('  No foreign key constraints found');
  }
}

main().catch(console.error);
