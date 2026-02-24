const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { execSync } = require('child_process');

const REGION = 'ap-south-1';
const ENVIRONMENT = 'dev';

// Get dev cluster info
let CLUSTER_ARN, SECRET_ARN, DB_NAME;

try {
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
  console.error('❌ Error:', error.message);
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
  console.log('Checking ALL constraints on content_pages table (DEV)');
  console.log('============================================================================\n');

  // Check ALL constraints on the table
  const allConstraints = await query(`
    SELECT 
      conname as constraint_name,
      contype as constraint_type,
      pg_get_constraintdef(oid) as constraint_definition
    FROM pg_constraint
    WHERE conrelid = 'content_pages'::regclass
    ORDER BY conname
  `);
  
  console.log('All constraints on content_pages:');
  if (allConstraints.rows && allConstraints.rows.length > 0) {
    allConstraints.rows.forEach(row => {
      console.log(`\n  Constraint: ${row.col0}`);
      console.log(`  Type: ${row.col1}`);
      console.log(`  Definition: ${row.col2}`);
    });
  } else {
    console.log('  No constraints found');
  }

  // Try to find what category value might be failing
  console.log('\n\nTrying to identify problematic category value...');
  console.log('If you can share the exact category value being inserted, we can add it to the constraint.');
}

main().catch(console.error);
