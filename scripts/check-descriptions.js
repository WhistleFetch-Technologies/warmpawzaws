const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { execSync } = require('child_process');

const REGION = 'ap-south-1';
const ENVIRONMENT = 'dev';

// Get cluster info dynamically
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
  console.log(`Cluster: ${CLUSTER_ARN}`);
  console.log(`DB: ${DB_NAME}, Secret: ${SECRET_ARN}\n`);
} catch (error) {
  console.error('Error getting cluster info:', error.message);
  process.exit(1);
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
  const cols = r.columnMetadata.map(c => c.name);
  return r.records.map(row => {
    const obj = {};
    row.forEach((v, i) => { obj[cols[i]] = v.stringValue || v.longValue || v.booleanValue || null; });
    return obj;
  });
}

(async () => {
  console.log('=== 1. services table: Tele entries ===');
  const services = await q("SELECT id, name, description FROM services WHERE LOWER(name) LIKE '%tele%' LIMIT 10");
  services.forEach(s => console.log(s.id, '|', s.name, '| desc:', s.description ? s.description.substring(0, 60) : 'NULL'));

  console.log('\n=== 2. vendor_services: Tele-Consultation with service_id check (first 15) ===');
  const vs = await q("SELECT vs.vendor_id, vs.service_name, vs.service_id, vs.custom_description FROM vendor_services vs WHERE LOWER(vs.service_name) LIKE '%tele%' AND vs.service_style = 'tele' LIMIT 15");
  vs.forEach(v => console.log(
    (v.vendor_id || '').substring(0, 8), '|',
    v.service_name, '|',
    'svc_id:', v.service_id ? v.service_id.substring(0, 8) : 'NULL', '|',
    'custom_desc:', v.custom_description ? v.custom_description.substring(0, 40) : 'NULL'
  ));

  console.log('\n=== 3. service_catalog: Tele entries ===');
  const sc = await q("SELECT service_name, service_style, SUBSTRING(description, 1, 60) as desc_preview FROM service_catalog WHERE LOWER(service_name) LIKE '%tele%' LIMIT 10");
  if (sc.length === 0) console.log('(no entries found)');
  sc.forEach(s => console.log(s.service_name, '|', s.service_style, '|', s.desc_preview || 'NULL'));

  console.log('\n=== 4. vendor_availability_v2: total + tele records ===');
  const vaTotal = await q("SELECT COUNT(*) as cnt FROM vendor_availability_v2");
  console.log('Total records:', vaTotal[0]?.cnt);
  const vaTele = await q("SELECT COUNT(*) as cnt FROM vendor_availability_v2 WHERE service_style = 'tele' OR service_styles::text LIKE '%tele%'");
  console.log('Tele records:', vaTele[0]?.cnt);

  console.log('\n=== 5. vendor_availability_v2: sample tele records ===');
  const vaSample = await q("SELECT vendor_id, day_of_week, start_time::text, end_time::text, service_style FROM vendor_availability_v2 WHERE service_style = 'tele' OR service_styles::text LIKE '%tele%' LIMIT 10");
  if (vaSample.length === 0) console.log('(no tele availability records found)');
  vaSample.forEach(v => console.log(
    (v.vendor_id || '').substring(0, 8), '| day:', v.day_of_week,
    '| time:', v.start_time, '-', v.end_time,
    '| style:', v.service_style
  ));
})().catch(console.error);
