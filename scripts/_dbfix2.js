const { execSync } = require('child_process');
const fs = require('fs');
const REGION = 'ap-south-1';
const CLUSTER = 'warmpawz-dev-cluster';
const SECRET = 'warmpawz-dev-rds-master-20260106164510791100000002';

const clusterArn = JSON.parse(execSync(`aws rds describe-db-clusters --db-cluster-identifier ${CLUSTER} --region ${REGION} --output json`, { encoding: 'utf8' })).DBClusters[0].DBClusterArn;
const secretArn = JSON.parse(execSync(`aws secretsmanager describe-secret --secret-id "${SECRET}" --region ${REGION} --output json`, { encoding: 'utf8' })).ARN;

function rds(sql) {
  const p = 'C:/Windows/Temp/_rds_tmp2.json';
  fs.writeFileSync(p, JSON.stringify({ resourceArn: clusterArn, secretArn, database: 'warmpawz', sql }));
  return JSON.parse(execSync(`aws rds-data execute-statement --cli-input-json file://${p} --region ${REGION} --output json`, { encoding: 'utf8', maxBuffer: 8*1024*1024 }));
}

// The booking created at 12:41 - what status/time is it?
console.log('\n=== Booking 3863ac90 (created at 12:41) ===');
const r1 = rds(`SELECT id::text, booking_date::text, booking_time::text, status, payment_status, total_amount::text FROM bookings WHERE id = '3863ac90-759a-48c6-b82f-5b21eb29a5d0'`).records || [];
for (const r of r1) console.log(r.map(c => c.stringValue ?? '').join(' | '));

// All non-cancelled bookings for this vendor on any future date
console.log('\n=== All active bookings for Vet Center Bindu (next 30 days) ===');
const r2 = rds(`
  SELECT id::text, booking_date::text, booking_time::text, customer_id::text, status, payment_status, total_amount::text
  FROM bookings
  WHERE vendor_id = '109ac8bc-9709-45a6-a7f8-c6ed7c63571c'
    AND booking_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
    AND status NOT IN ('cancelled','no_show','rescheduled')
  ORDER BY booking_date, booking_time
`).records || [];
for (const r of r2) console.log(r.map(c => c.stringValue ?? '').join(' | '));
