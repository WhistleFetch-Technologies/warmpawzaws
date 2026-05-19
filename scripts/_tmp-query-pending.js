const { execSync } = require('child_process');
const fs = require('fs');
const clusterArn = JSON.parse(execSync('aws rds describe-db-clusters --db-cluster-identifier warmpawz-dev-cluster --region ap-south-1 --output json', { encoding: 'utf8' })).DBClusters[0].DBClusterArn;
const secretArn = JSON.parse(execSync('aws secretsmanager describe-secret --secret-id warmpawz-dev-rds-master-20260106164510791100000002 --region ap-south-1 --output json', { encoding: 'utf8' })).ARN;
const sql = `
SELECT id::text, booking_time::text, status, total_amount::text, created_at::text
FROM bookings
WHERE customer_id = '834b9608-93e9-4604-9ce3-6c87d74c7d0c'
  AND vendor_id = '109ac8bc-9709-45a6-a7f8-c6ed7c63571c'
  AND booking_date = '2026-05-24'
  AND status NOT IN ('cancelled', 'no_show', 'rescheduled')
ORDER BY booking_time`;
const p = 'C:/Windows/Temp/rds-pending.json';
fs.writeFileSync(p, JSON.stringify({ resourceArn: clusterArn, secretArn, database: 'warmpawz', sql }));
const out = JSON.parse(execSync(`aws rds-data execute-statement --cli-input-json file://${p} --region ap-south-1 --output json`, { encoding: 'utf8' }));
for (const row of out.records || []) {
  console.log(row.map((c) => c.stringValue ?? '').join(' | '));
}
