const { execSync } = require('child_process');
const fs = require('fs');
const REGION = 'ap-south-1';
const CLUSTER = 'warmpawz-dev-cluster';
const SECRET = 'warmpawz-dev-rds-master-20260106164510791100000002';

const clusterArn = JSON.parse(execSync(`aws rds describe-db-clusters --db-cluster-identifier ${CLUSTER} --region ${REGION} --output json`, { encoding: 'utf8' })).DBClusters[0].DBClusterArn;
const secretArn = JSON.parse(execSync(`aws secretsmanager describe-secret --secret-id "${SECRET}" --region ${REGION} --output json`, { encoding: 'utf8' })).ARN;

function rds(sql) {
  const p = 'C:/Windows/Temp/_rds_tmp.json';
  fs.writeFileSync(p, JSON.stringify({ resourceArn: clusterArn, secretArn, database: 'warmpawz', sql }));
  return JSON.parse(execSync(`aws rds-data execute-statement --cli-input-json file://${p} --region ${REGION} --output json`, { encoding: 'utf8', maxBuffer: 8*1024*1024 }));
}

// ===== SHOW all May 24 bookings for this customer/vendor =====
console.log('\n=== ALL bookings on May 24 for test customer (any status) ===');
const showRows = rds(`
  SELECT id::text, booking_time::text, status, payment_status, total_amount::text, created_at::text
  FROM bookings
  WHERE customer_id = '834b9608-93e9-4604-9ce3-6c87d74c7d0c'
    AND vendor_id   = '109ac8bc-9709-45a6-a7f8-c6ed7c63571c'
    AND booking_date = '2026-05-24'
  ORDER BY booking_time, created_at DESC
`).records || [];
for (const r of showRows) console.log(r.map(c => c.stringValue ?? '').join(' | '));

// ===== CANCEL all non-terminal bookings so slot is clean =====
const cancelled = rds(`
  UPDATE bookings
  SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
  WHERE customer_id = '834b9608-93e9-4604-9ce3-6c87d74c7d0c'
    AND vendor_id   = '109ac8bc-9709-45a6-a7f8-c6ed7c63571c'
    AND booking_date = '2026-05-24'
    AND status NOT IN ('cancelled','no_show','rescheduled')
`);
console.log(`\nCancelled ${cancelled.numberOfRecordsUpdated} stale booking(s) on May 24.`);

// ===== SHOW ALL blocked slot-unique confirmed bookings for any date / this vendor =====
console.log('\n=== Confirmed (slot-locking) bookings for Vet Center Bindu ===');
const confRows = rds(`
  SELECT id::text, booking_date::text, booking_time::text, customer_id::text, status, payment_status
  FROM bookings
  WHERE vendor_id = '109ac8bc-9709-45a6-a7f8-c6ed7c63571c'
    AND status = 'confirmed'
    AND payment_status = 'pending'
    AND booking_date >= CURRENT_DATE
  ORDER BY booking_date, booking_time
`).records || [];
for (const r of confRows) console.log(r.map(c => c.stringValue ?? '').join(' | '));
