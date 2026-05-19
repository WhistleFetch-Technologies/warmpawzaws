const { execSync } = require('child_process');
const fs = require('fs');
const REGION = 'ap-south-1';
const clusterArn = JSON.parse(execSync('aws rds describe-db-clusters --db-cluster-identifier warmpawz-dev-cluster --region ap-south-1 --output json', { encoding: 'utf8' })).DBClusters[0].DBClusterArn;
const secretArn = JSON.parse(execSync('aws secretsmanager describe-secret --secret-id warmpawz-dev-rds-master-20260106164510791100000002 --region ap-south-1 --output json', { encoding: 'utf8' })).ARN;
function rds(sql) {
  const p = 'C:/Windows/Temp/_rds_tmp3.json';
  fs.writeFileSync(p, JSON.stringify({ resourceArn: clusterArn, secretArn, database: 'warmpawz', sql }));
  return JSON.parse(execSync(`aws rds-data execute-statement --cli-input-json file://${p} --region ap-south-1 --output json`, { encoding: 'utf8', maxBuffer: 8*1024*1024 }));
}

// Find booking 3863ac90 without date filter
const r1 = rds(`SELECT id::text, booking_date::text, booking_time::text, status, payment_status FROM bookings WHERE id = '3863ac90-759a-48c6-b82f-5b21eb29a5d0'`).records || [];
console.log('=== 3863ac90 ===', r1.length ? r1[0].map(c=>c.stringValue??'').join(' | ') : 'NOT FOUND - was rolled back');

// Any unique indexes on bookings?
const r2 = rds(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename='bookings' AND indexdef ILIKE '%unique%' ORDER BY indexname`).records || [];
console.log('\n=== Unique indexes on bookings ===');
for (const r of r2) console.log(r.map(c=>c.stringValue??'').join('\n  '));

// What idempotency records exist?
const r3 = rds(`SELECT scope_key, idempotency_key, state, created_at::text FROM idempotency_records WHERE created_at > NOW() - INTERVAL '2 hours' ORDER BY created_at DESC LIMIT 10`).records || [];
console.log('\n=== Recent idempotency records ===');
for (const r of r3) console.log(r.map(c=>c.stringValue??'').join(' | '));
