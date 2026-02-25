const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { execSync } = require('child_process');

const REGION = 'ap-south-1';

async function runForEnv(env) {
  console.log(`\n========== ${env.toUpperCase()} ==========`);
  const clusterId = `warmpawz-${env}-cluster`;
  let CLUSTER_ARN, SECRET_ARN, DB_NAME;
  
  try {
    const clusterInfo = JSON.parse(execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    ));
    CLUSTER_ARN = clusterInfo.DBClusters[0].DBClusterArn;
    DB_NAME = clusterInfo.DBClusters[0].DatabaseName || 'warmpawz';
    let secretArn = clusterInfo.DBClusters[0].MasterUserSecret?.SecretArn;
    if (!secretArn) {
      const secretName = env === 'dev' 
        ? 'warmpawz-dev-rds-master-20260106164510791100000002'
        : 'warmpawz-prod-rds-master-20260207201049162400000001';
      const describeSecret = JSON.parse(execSync(
        `aws secretsmanager describe-secret --secret-id "${secretName}" --region ${REGION} --output json`,
        { encoding: 'utf8' }
      ));
      secretArn = describeSecret.ARN;
    }
    SECRET_ARN = secretArn;
  } catch (error) {
    console.error(`Error getting ${env} cluster info:`, error.message);
    return;
  }

  const client = new RDSDataClient({ region: REGION });
  
  async function q(sql) {
    const r = await client.send(new ExecuteStatementCommand({
      resourceArn: CLUSTER_ARN,
      secretArn: SECRET_ARN,
      database: DB_NAME,
      sql,
      includeResultMetadata: true
    }));
    return r.numberOfRecordsUpdated || 0;
  }

  async function qSelect(sql) {
    const r = await client.send(new ExecuteStatementCommand({
      resourceArn: CLUSTER_ARN,
      secretArn: SECRET_ARN,
      database: DB_NAME,
      sql,
      includeResultMetadata: true
    }));
    const cols = r.columnMetadata.map(c => c.name);
    return r.records.map(row => {
      const obj = {};
      row.forEach((v, i) => { obj[cols[i]] = v.stringValue || v.longValue || v.booleanValue || null; });
      return obj;
    });
  }

  // 1. Update Tele-Consultation description in services table
  console.log('Updating Tele-Consultation description in services table...');
  const updated = await q(
    "UPDATE services SET description = 'Connect with a veterinary professional via secure video call for quick consultations, follow-ups, and general pet health advice.' WHERE LOWER(name) = 'tele-consultation' AND (description IS NULL OR description = '')"
  );
  console.log(`  Updated ${updated} row(s)`);

  // 2. Update Instant Consultation description 
  console.log('Updating Instant Consultation description in services table...');
  const updated2 = await q(
    "UPDATE services SET description = 'Get immediate veterinary advice through a quick video consultation.' WHERE LOWER(name) = 'instant consultation' AND (description IS NULL OR description = '')"
  );
  console.log(`  Updated ${updated2} row(s)`);

  // 3. Update Emergency Video Consult description
  console.log('Updating Emergency Video Consult description in services table...');
  const updated3 = await q(
    "UPDATE services SET description = 'Emergency video consultation available during late hours for urgent pet care needs.' WHERE LOWER(name) LIKE '%emergency video%' AND (description IS NULL OR description = '')"
  );
  console.log(`  Updated ${updated3} row(s)`);

  // 4. Update General Consultation description
  console.log('Updating General Consultation description in services table...');
  const updated4 = await q(
    "UPDATE services SET description = 'Video consultation with a veterinarian for general pet health, preventive care, and routine check-ups.' WHERE LOWER(name) = 'general consultation' AND (description IS NULL OR description = '')"
  );
  console.log(`  Updated ${updated4} row(s)`);

  // Verify
  const verify = await qSelect("SELECT id, name, SUBSTRING(description, 1, 80) as desc FROM services WHERE LOWER(name) IN ('tele-consultation', 'instant consultation', 'general consultation') OR LOWER(name) LIKE '%emergency video%'");
  console.log('Verification:');
  verify.forEach(v => console.log(`  ${v.name}: ${v.desc || 'NULL'}`));
}

(async () => {
  await runForEnv('dev');
  await runForEnv('prod');
})().catch(console.error);
