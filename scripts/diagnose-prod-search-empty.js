#!/usr/bin/env node
/**
 * READ-ONLY diagnostic: why does GET /search return zero rows on prod?
 *
 * Runs the same filter clauses used by `searchWithSQL` (backend/lambda/src/endpoints/search.ts)
 * one by one and prints a count after each, so we can see exactly which filter drops everything.
 *
 * Usage:
 *   node scripts/diagnose-prod-search-empty.js
 *
 * No mutations. Safe to run any time.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const CLUSTER_IDENTIFIER = 'warmpawz-prod-cluster';
const SECRET_NAME = 'warmpawz-prod-rds-master-20260207201049162400000001';
const DATABASE_NAME = 'warmpawz';

function awsCli() { return 'aws'; }

function getInfo() {
  const c = JSON.parse(execSync(
    `${awsCli()} rds describe-db-clusters --db-cluster-identifier ${CLUSTER_IDENTIFIER} --region ${REGION} --output json`,
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['inherit', 'pipe', 'inherit'] }
  ));
  const s = JSON.parse(execSync(
    `${awsCli()} secretsmanager describe-secret --secret-id "${SECRET_NAME}" --region ${REGION} --output json`,
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, stdio: ['inherit', 'pipe', 'inherit'] }
  ));
  return { clusterArn: c.DBClusters[0].DBClusterArn, secretArn: s.ARN };
}

function exec(clusterArn, secretArn, sql) {
  const tmp = path.join(__dirname, `_tmp_search_diag_${Date.now()}_${Math.random().toString(36).slice(2,7)}.json`);
  fs.writeFileSync(tmp, JSON.stringify({ resourceArn: clusterArn, secretArn, database: DATABASE_NAME, sql }), 'utf8');
  const fileUrl = 'file://' + tmp.replace(/\\/g, '/');
  try {
    const out = execSync(
      `${awsCli()} rds-data execute-statement --cli-input-json "${fileUrl}" --region ${REGION} --output json`,
      { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['inherit', 'pipe', 'inherit'] }
    );
    return JSON.parse(out);
  } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
}

function pickFirstScalar(res) {
  if (!res || !res.records || res.records.length === 0) return null;
  const cell = res.records[0][0];
  if (!cell) return null;
  if ('longValue'   in cell) return cell.longValue;
  if ('doubleValue' in cell) return cell.doubleValue;
  if ('stringValue' in cell) return cell.stringValue;
  if ('booleanValue' in cell) return cell.booleanValue;
  return null;
}

function pickRows(res) {
  if (!res || !res.records) return [];
  return res.records.map(r => r.map(c => {
    if (!c || c.isNull) return null;
    if ('stringValue' in c) return c.stringValue;
    if ('longValue'   in c) return c.longValue;
    if ('doubleValue' in c) return c.doubleValue;
    if ('booleanValue' in c) return c.booleanValue;
    return null;
  }));
}

function step(label, sql, runner) {
  const r = runner(sql);
  const v = pickFirstScalar(r);
  console.log(`  ${label.padEnd(60)} ${v === null ? '?' : v}`);
  return v;
}

function main() {
  console.log('============================================================');
  console.log('Diagnostic: prod /search empty result — filter drill-down');
  console.log(`Cluster: ${CLUSTER_IDENTIFIER} | Region: ${REGION}`);
  console.log('============================================================\n');

  const { clusterArn, secretArn } = getInfo();
  const run = (sql) => exec(clusterArn, secretArn, sql);

  console.log('Vendors table:');
  step('total vendors',                                    'SELECT COUNT(*) FROM vendors', run);
  step('vendors WHERE is_active = true',                   "SELECT COUNT(*) FROM vendors WHERE is_active = true", run);
  step("vendors WHERE status = 'approved'",                "SELECT COUNT(*) FROM vendors WHERE status = 'approved'", run);
  step('vendors with latitude+longitude',                  'SELECT COUNT(*) FROM vendors WHERE latitude IS NOT NULL AND longitude IS NOT NULL', run);
  step('vendors active+approved+geo',                      `SELECT COUNT(*) FROM vendors WHERE is_active = true AND status = 'approved' AND latitude IS NOT NULL AND longitude IS NOT NULL`, run);

  console.log('\nVendor services:');
  step('total vendor_services',                            'SELECT COUNT(*) FROM vendor_services', run);
  step('vendor_services is_enabled = true',                'SELECT COUNT(*) FROM vendor_services WHERE is_enabled = true', run);
  step("publish_status IN ('published','auto_published')", "SELECT COUNT(*) FROM vendor_services WHERE publish_status IN ('published','auto_published')", run);
  step('enabled + published/auto_published',               "SELECT COUNT(*) FROM vendor_services WHERE is_enabled = true AND publish_status IN ('published','auto_published')", run);

  console.log('\nVendor availability v2:');
  step('total vendor_availability_v2',                     'SELECT COUNT(*) FROM vendor_availability_v2', run);
  step('distinct vendor_id in vendor_availability_v2',     'SELECT COUNT(DISTINCT vendor_id) FROM vendor_availability_v2', run);

  console.log('\nVendor identity:');
  step('total vendor_identity',                            'SELECT COUNT(*) FROM vendor_identity', run);

  console.log('\nFinal /search filter (vendors that survive everything):');
  step('vendors passing all live-listing filters',
    `SELECT COUNT(*) FROM vendors v
       WHERE v.is_active = true
         AND v.status = 'approved'
         AND v.latitude IS NOT NULL AND v.longitude IS NOT NULL
         AND EXISTS (SELECT 1 FROM vendor_services vs
                       WHERE vs.vendor_id = v.id
                         AND vs.is_enabled = true
                         AND vs.publish_status IN ('published','auto_published'))
         AND EXISTS (SELECT 1 FROM vendor_availability_v2 va
                       WHERE va.vendor_id = v.id
                          OR va.vendor_id IN (SELECT id FROM vendor_identity
                                                WHERE vendor_id = v.id OR phone = v.phone))`, run);

  step('… without the vendor_availability_v2 EXISTS',
    `SELECT COUNT(*) FROM vendors v
       WHERE v.is_active = true
         AND v.status = 'approved'
         AND v.latitude IS NOT NULL AND v.longitude IS NOT NULL
         AND EXISTS (SELECT 1 FROM vendor_services vs
                       WHERE vs.vendor_id = v.id
                         AND vs.is_enabled = true
                         AND vs.publish_status IN ('published','auto_published'))`, run);

  step('… without the vendor_services EXISTS',
    `SELECT COUNT(*) FROM vendors v
       WHERE v.is_active = true
         AND v.status = 'approved'
         AND v.latitude IS NOT NULL AND v.longitude IS NOT NULL
         AND EXISTS (SELECT 1 FROM vendor_availability_v2 va
                       WHERE va.vendor_id = v.id
                          OR va.vendor_id IN (SELECT id FROM vendor_identity
                                                WHERE vendor_id = v.id OR phone = v.phone))`, run);

  console.log('\nSample vendors (top 5 active+approved):');
  const sample = run(`SELECT id, business_name, is_active, status,
                              (latitude IS NOT NULL AND longitude IS NOT NULL) AS has_geo
                         FROM vendors
                        WHERE is_active = true AND status = 'approved'
                        LIMIT 5`);
  for (const row of pickRows(sample)) console.log('  ', row.join(' | '));

  console.log('\nSample published+enabled services (top 5):');
  const samp2 = run(`SELECT id, vendor_id, service_name, publish_status, is_enabled
                       FROM vendor_services
                      WHERE is_enabled = true
                        AND publish_status IN ('published','auto_published')
                      LIMIT 5`);
  for (const row of pickRows(samp2)) console.log('  ', row.join(' | '));

  console.log('\nSample vendor_availability_v2 (top 5):');
  const samp3 = run(`SELECT vendor_id FROM vendor_availability_v2 LIMIT 5`);
  for (const row of pickRows(samp3)) console.log('  ', row.join(' | '));

  console.log('\nSample vendor_identity (top 5):');
  const samp4 = run(`SELECT id, vendor_id, phone FROM vendor_identity LIMIT 5`);
  for (const row of pickRows(samp4)) console.log('  ', row.join(' | '));

  console.log('\nDone.');
}

main();
