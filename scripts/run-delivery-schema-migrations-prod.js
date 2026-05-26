#!/usr/bin/env node
/**
 * Apply SQL migrations required by delivery-service (Hibernate ddl-auto=validate on prod ECS).
 * Uses RDS Data API — no VPN required.
 *
 * Usage (from repo root):
 *   node scripts/run-delivery-schema-migrations-prod.js
 *
 * After success:
 *   aws ecs update-service --cluster warmpawz-prod-delivery-cluster --service warmpawz-prod-delivery-svc --region ap-south-1 --force-new-deployment
 *   aws logs tail /ecs/warmpawz-prod-delivery --region ap-south-1 --since 5m
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REGION = 'ap-south-1';
const CLUSTER_ARN = 'arn:aws:rds:ap-south-1:057442119249:cluster:warmpawz-prod-cluster';
const SECRET_ARN =
  'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-prod-rds-master-20260207201049162400000001-hmqkCE';
const DATABASE = 'warmpawz';

/** Order matters. Skip 024 if delivery_partners already exists. */
const MIGRATIONS = [
  '024_delivery_integration_tables.sql',
  '420_logistics_partners_enhancements.sql',
  '633_delivery_tracking_and_location_history.sql',
  '746_delivery_tracking_metadata_column.sql',
  '749_canonical_meal_subscription_architecture.sql',
  '750_delivery_location_history_source.sql',
  '1001_add_pidge_logistics_partner.sql',
  '1002_pharmacy_meal_logistics_type_pidge_dunzo.sql',
  '1010_meal_orders_pidge_dispatch.sql',
  '1015_pidge_support_tickets.sql',
  '1016_pidge_partial_delivery_workflows.sql',
  '1017_prod_delivery_hibernate_gaps.sql',
];

function splitStatements(sql) {
  const statements = [];
  let current = '';
  let inDollarBlock = false;
  for (const line of sql.split('\n')) {
    const trimmed = line.trim();
    if (!inDollarBlock && (trimmed.startsWith('--') || trimmed === '')) continue;
    if (!inDollarBlock && (trimmed.startsWith('DO $$') || trimmed.startsWith('DO $'))) {
      inDollarBlock = true;
      current += line + '\n';
      continue;
    }
    if (inDollarBlock) {
      current += line + '\n';
      if (/\$\$\s*;/.test(trimmed)) {
        inDollarBlock = false;
        if (current.trim()) statements.push(current.trim());
        current = '';
      }
      continue;
    }
    current += line + '\n';
    if (trimmed.endsWith(';')) {
      if (current.trim()) statements.push(current.trim());
      current = '';
    }
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

function executeSql(sql) {
  const inputFile = path.join(__dirname, '_tmp_delivery_schema.json');
  fs.writeFileSync(
    inputFile,
    JSON.stringify({ resourceArn: CLUSTER_ARN, secretArn: SECRET_ARN, database: DATABASE, sql }),
    'utf8'
  );
  try {
    execSync(
      `aws rds-data execute-statement --cli-input-json file://${inputFile} --region ${REGION}`,
      { encoding: 'utf8', timeout: 120000, stdio: 'pipe' }
    );
    try {
      fs.unlinkSync(inputFile);
    } catch (_) {}
    return { ok: true };
  } catch (e) {
    try {
      fs.unlinkSync(inputFile);
    } catch (_) {}
    const msg = (e.stderr || e.message || '').toString();
    if (/already exists|duplicate key|IF NOT EXISTS/i.test(msg)) return { ok: true, skipped: true };
    return { ok: false, msg: msg.slice(0, 400) };
  }
}

function main() {
  console.log('Prod delivery-service schema migrations (RDS Data API)\n');
  let failures = 0;
  for (const file of MIGRATIONS) {
    const p = path.join(__dirname, '..', 'db', 'migrations', file);
    if (!fs.existsSync(p)) {
      console.log(`SKIP (missing file): ${file}`);
      continue;
    }
    const stmts = splitStatements(fs.readFileSync(p, 'utf8'));
    console.log(`\n=== ${file} (${stmts.length} statements) ===`);
    for (let i = 0; i < stmts.length; i++) {
      const preview = stmts[i].replace(/\s+/g, ' ').slice(0, 70);
      const r = executeSql(stmts[i]);
      if (r.ok) process.stdout.write(`  [${i + 1}/${stmts.length}] OK ${preview}\n`);
      else {
        failures++;
        console.log(`  [${i + 1}/${stmts.length}] FAIL ${preview}`);
        console.log(`    ${r.msg}`);
      }
    }
  }
  console.log(failures ? `\nDone with ${failures} failed statement(s).` : '\nDone.');
  if (failures) process.exit(1);
}

main();
