const { execSync } = require('child_process');
const fs = require('fs');
const clusterArn = JSON.parse(execSync('aws rds describe-db-clusters --db-cluster-identifier warmpawz-dev-cluster --region ap-south-1 --output json', { encoding: 'utf8' })).DBClusters[0].DBClusterArn;
const secretArn = JSON.parse(execSync('aws secretsmanager describe-secret --secret-id warmpawz-dev-rds-master-20260106164510791100000002 --region ap-south-1 --output json', { encoding: 'utf8' })).ARN;
function rds(sql) {
  const p = 'C:/Windows/Temp/_rds_svc2.json';
  fs.writeFileSync(p, JSON.stringify({ resourceArn: clusterArn, secretArn, database: 'warmpawz', sql }));
  return JSON.parse(execSync(`aws rds-data execute-statement --cli-input-json file://${p} --region ap-south-1 --output json`, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
}

// Check columns
const cols = rds(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='vendor_services' ORDER BY ordinal_position`).records || [];
console.log('=== vendor_services columns ===');
for (const r of cols) console.log(r.map(c => c.stringValue ?? '').join(' | '));

// Sample row
const VENDOR_ID = '109ac8bc-9709-45a6-a7f8-c6ed7c63571c';
const sample = rds(`SELECT * FROM vendor_services WHERE vendor_id='${VENDOR_ID}' LIMIT 1`).records || [];
console.log('\n=== sample row for vendor (col count=' + (sample[0]?.length ?? 0) + ') ===');
if (sample[0]) {
  const vals = sample[0].map(c => {
    if (c.stringValue !== undefined) return c.stringValue;
    if (c.longValue !== undefined) return c.longValue;
    if (c.doubleValue !== undefined) return c.doubleValue;
    if (c.booleanValue !== undefined) return c.booleanValue;
    if (c.isNull) return 'NULL';
    return '?';
  });
  cols.forEach((col, i) => console.log(`  ${col[0].stringValue}: ${vals[i]}`));
}
