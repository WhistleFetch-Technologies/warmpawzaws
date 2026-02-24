const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
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
  
  let secretArn = clusterInfo.DBClusters[0].MasterUserSecret?.SecretArn;
  if (!secretArn) {
    const secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
    const describeSecret = JSON.parse(execSync(
      `aws secretsmanager describe-secret --secret-id "${secretName}" --region ${REGION} --output json`,
      { encoding: 'utf8' }
    ));
    secretArn = describeSecret.ARN;
  }
  SECRET_ARN = secretArn;
} catch (error) {
  console.error('❌ Error getting cluster info:', error.message);
  process.exit(1);
}

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
  console.log('Checking content_pages constraint (DEV)');
  console.log('============================================================================\n');

  // Check current constraint
  console.log('1. Current constraint definition:');
  const constraintCheck = await query(`
    SELECT conname, pg_get_constraintdef(oid) as constraint_def
    FROM pg_constraint
    WHERE conrelid = 'content_pages'::regclass
      AND conname = 'content_pages_category_check'
  `);
  
  if (constraintCheck.rows && constraintCheck.rows.length > 0) {
    console.log(`   Constraint name: ${constraintCheck.rows[0].col0}`);
    console.log(`   Definition: ${constraintCheck.rows[0].col1}`);
  } else {
    console.log('   ❌ Constraint not found!');
  }

  // Check existing categories in the table
  console.log('\n2. Existing categories in content_pages table:');
  const categoriesCheck = await query(`
    SELECT DISTINCT category, COUNT(*) as count
    FROM content_pages
    GROUP BY category
    ORDER BY category
  `);
  
  if (categoriesCheck.rows && categoriesCheck.rows.length > 0) {
    console.log('   Categories found:');
    categoriesCheck.rows.forEach(row => {
      console.log(`     - ${row.col0 || 'NULL'}: ${row.col1} row(s)`);
    });
  } else {
    console.log('   No rows in content_pages table');
  }

  // Check table structure
  console.log('\n3. Table structure:');
  const tableCheck = await query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'content_pages'
    ORDER BY ordinal_position
  `);
  
  if (tableCheck.rows && tableCheck.rows.length > 0) {
    console.log('   Columns:');
    tableCheck.rows.forEach(row => {
      console.log(`     - ${row.col0}: ${row.col1} (nullable: ${row.col2}, default: ${row.col3 || 'NULL'})`);
    });
  }
}

main().catch(console.error);
