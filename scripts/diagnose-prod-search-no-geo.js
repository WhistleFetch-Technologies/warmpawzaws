#!/usr/bin/env node
/* READ-ONLY: how many vendors survive the search filter once we drop the geo NOT-NULL requirement? */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REGION = 'ap-south-1';
const CLUSTER = 'warmpawz-prod-cluster';
const SECRET  = 'warmpawz-prod-rds-master-20260207201049162400000001';
const DB      = 'warmpawz';

const cluster = JSON.parse(execSync(`aws rds describe-db-clusters --db-cluster-identifier ${CLUSTER} --region ${REGION} --output json`, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['inherit', 'pipe', 'inherit'] })).DBClusters[0];
const secret  = JSON.parse(execSync(`aws secretsmanager describe-secret --secret-id "${SECRET}" --region ${REGION} --output json`, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, stdio: ['inherit', 'pipe', 'inherit'] }));

function run(sql) {
  const tmp = path.join(__dirname, `_t_${Date.now()}_${Math.random().toString(36).slice(2,7)}.json`);
  fs.writeFileSync(tmp, JSON.stringify({ resourceArn: cluster.DBClusterArn, secretArn: secret.ARN, database: DB, sql }), 'utf8');
  try {
    const out = execSync(`aws rds-data execute-statement --cli-input-json "file://${tmp.replace(/\\/g,'/')}" --region ${REGION} --output json`, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['inherit', 'pipe', 'inherit'] });
    return JSON.parse(out);
  } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
}

function scalar(r) { const c = r.records?.[0]?.[0]; if (!c) return null; return c.longValue ?? c.stringValue ?? c.doubleValue ?? null; }

console.log('Vendor counts WITHOUT geo NOT-NULL requirement:\n');

console.log('  active+approved+services-published+availability:',
  scalar(run(`SELECT COUNT(*) FROM vendors v
                WHERE v.is_active = true AND v.status = 'approved'
                  AND EXISTS (SELECT 1 FROM vendor_services vs
                                WHERE vs.vendor_id = v.id
                                  AND vs.is_enabled = true
                                  AND vs.publish_status IN ('published','auto_published'))
                  AND EXISTS (SELECT 1 FROM vendor_availability_v2 va
                                WHERE va.vendor_id = v.id
                                   OR va.vendor_id IN (SELECT id FROM vendor_identity
                                                         WHERE vendor_id = v.id OR phone = v.phone))`)));

console.log('  active+approved+services-published (no availability gate):',
  scalar(run(`SELECT COUNT(*) FROM vendors v
                WHERE v.is_active = true AND v.status = 'approved'
                  AND EXISTS (SELECT 1 FROM vendor_services vs
                                WHERE vs.vendor_id = v.id
                                  AND vs.is_enabled = true
                                  AND vs.publish_status IN ('published','auto_published'))`)));

console.log('  matching keyword "vet" with same broader filter (no geo):',
  scalar(run(`SELECT COUNT(*) FROM vendors v
                WHERE v.is_active = true AND v.status = 'approved'
                  AND EXISTS (SELECT 1 FROM vendor_services vs
                                WHERE vs.vendor_id = v.id
                                  AND vs.is_enabled = true
                                  AND vs.publish_status IN ('published','auto_published'))
                  AND (v.business_name ILIKE '%vet%' OR v.specialization ILIKE '%vet%'
                       OR EXISTS (SELECT 1 FROM vendor_services vs2 WHERE vs2.vendor_id = v.id
                                  AND vs2.publish_status IN ('published','auto_published')
                                  AND (vs2.service_name ILIKE '%vet%' OR vs2.category ILIKE '%vet%' OR vs2.sub_category ILIKE '%vet%')))`)));

console.log('  services rows that survive without geo gate (limit 5):');
const rows = run(`SELECT vs.id, v.business_name, vs.service_name
                    FROM vendor_services vs JOIN vendors v ON vs.vendor_id = v.id
                   WHERE vs.publish_status IN ('published','auto_published')
                     AND vs.is_enabled = true
                     AND v.is_active = true AND v.status = 'approved'
                     AND EXISTS (SELECT 1 FROM vendor_availability_v2 va
                                   WHERE va.vendor_id = v.id
                                      OR va.vendor_id IN (SELECT id FROM vendor_identity
                                                            WHERE vendor_id = v.id OR phone = v.phone))
                   LIMIT 5`);
for (const r of (rows.records || [])) {
  console.log('   ', r.map(c => c?.stringValue || '').join(' | '));
}

console.log('\nDone.');
