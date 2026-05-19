const { execSync } = require('child_process');
const fs = require('fs');
const clusterArn = JSON.parse(execSync('aws rds describe-db-clusters --db-cluster-identifier warmpawz-dev-cluster --region ap-south-1 --output json', { encoding: 'utf8' })).DBClusters[0].DBClusterArn;
const secretArn = JSON.parse(execSync('aws secretsmanager describe-secret --secret-id warmpawz-dev-rds-master-20260106164510791100000002 --region ap-south-1 --output json', { encoding: 'utf8' })).ARN;
function rds(sql) {
  const p = 'C:/Windows/Temp/_rds_svc.json';
  fs.writeFileSync(p, JSON.stringify({ resourceArn: clusterArn, secretArn, database: 'warmpawz', sql }));
  return JSON.parse(execSync(`aws rds-data execute-statement --cli-input-json file://${p} --region ap-south-1 --output json`, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
}

const SERVICE_ID = '53d04591-ba80-4b4d-acd9-3e6064a53c55';
const VENDOR_ID  = '109ac8bc-9709-45a6-a7f8-c6ed7c63571c';

// Check if service exists anywhere
const exists = rds(`SELECT id::text, vendor_id::text, name, is_active FROM vendor_services WHERE id = '${SERVICE_ID}'`).records || [];
console.log('=== vendor_services lookup ===');
console.log(exists.length ? exists[0].map(c => c.stringValue ?? c.booleanValue ?? '').join(' | ') : 'NOT FOUND');

// Check vendor_services columns
const cols = rds(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='vendor_services' ORDER BY ordinal_position`).records || [];
console.log('\n=== vendor_services columns ===');
for (const r of cols) console.log(r.map(c => c.stringValue ?? '').join(' | '));

// Sample a row from vendor_services for this vendor
const sample = rds(`SELECT * FROM vendor_services WHERE vendor_id='${VENDOR_ID}' LIMIT 1`).records || [];
console.log('\n=== sample row for vendor ===');
for (const r of sample) console.log(r.map(c => c.stringValue ?? c.longValue ?? c.doubleValue ?? c.booleanValue ?? '').join(' | '));
