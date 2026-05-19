const { execSync } = require('child_process');
const fs = require('fs');
const REGION = 'ap-south-1';
const clusterArn = JSON.parse(execSync('aws rds describe-db-clusters --db-cluster-identifier warmpawz-dev-cluster --region ap-south-1 --output json', { encoding: 'utf8' })).DBClusters[0].DBClusterArn;
const secretArn = JSON.parse(execSync('aws secretsmanager describe-secret --secret-id warmpawz-dev-rds-master-20260106164510791100000002 --region ap-south-1 --output json', { encoding: 'utf8' })).ARN;
function rds(sql) {
  const p = 'C:/Windows/Temp/_rds_fkfix.json';
  fs.writeFileSync(p, JSON.stringify({ resourceArn: clusterArn, secretArn, database: 'warmpawz', sql }));
  return JSON.parse(execSync(`aws rds-data execute-statement --cli-input-json file://${p} --region ${REGION} --output json`, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
}

// 1) Show all FK constraints on bookings table
console.log('\n=== FK constraints on bookings ===');
const fks = rds(`
  SELECT conname AS constraint_name, 
         pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
  WHERE conrelid = 'bookings'::regclass
    AND contype = 'f'
  ORDER BY conname
`).records || [];
for (const r of fks) console.log(r.map(c => c.stringValue ?? '').join(' | '));

// 2) Drop the offending FK constraint
console.log('\n=== Dropping bookings_service_id_vendor_services_fkey ===');
try {
  const drop = rds(`ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_service_id_vendor_services_fkey`);
  console.log('Dropped OK, records updated:', drop.numberOfRecordsUpdated ?? 0);
} catch (e) {
  console.error('Error dropping constraint:', e.message);
}

// 3) Also drop any other vendor_services or vendor_id FK that might block
const otherFkNames = fks
  .filter(r => {
    const def = r[1]?.stringValue ?? '';
    return def.includes('vendor_services') || def.includes('vendors') || def.includes('customers');
  })
  .map(r => r[0]?.stringValue ?? '');
for (const name of otherFkNames) {
  if (name && name !== 'bookings_service_id_vendor_services_fkey') {
    console.log(`\nDropping FK: ${name}`);
    try { rds(`ALTER TABLE bookings DROP CONSTRAINT IF EXISTS "${name}"`); console.log('Dropped.'); }
    catch (e) { console.error('Error:', e.message); }
  }
}

// 4) Verify constraints remaining
console.log('\n=== Remaining FK constraints on bookings ===');
const remaining = rds(`
  SELECT conname, pg_get_constraintdef(oid) AS def
  FROM pg_constraint WHERE conrelid='bookings'::regclass AND contype='f' ORDER BY conname
`).records || [];
for (const r of remaining) console.log(r.map(c => c.stringValue ?? '').join(' | '));

// 5) Also clear the stale idempotency record so the user gets a fresh start
console.log('\n=== Clearing stale idempotency records for this customer ===');
const idempClear = rds(`DELETE FROM idempotency_records WHERE idempotency_key LIKE 'test-1630%' OR idempotency_key LIKE 'test-1730%'`);
console.log(`Deleted ${idempClear.numberOfRecordsUpdated} idempotency record(s).`);
