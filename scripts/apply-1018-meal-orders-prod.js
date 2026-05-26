#!/usr/bin/env node
/** Apply only 1018_prod_meal_orders_bootstrap.sql on prod RDS. */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REGION = 'ap-south-1';
const CLUSTER_ARN = 'arn:aws:rds:ap-south-1:057442119249:cluster:warmpawz-prod-cluster';
const SECRET_ARN =
  'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-prod-rds-master-20260207201049162400000001-hmqkCE';
const DATABASE = 'warmpawz';

const sql = fs.readFileSync(
  path.join(__dirname, '..', 'db', 'migrations', '1018_prod_meal_orders_bootstrap.sql'),
  'utf8'
);

const statements = sql
  .split('\n')
  .filter((line) => {
    const t = line.trim();
    return t && !t.startsWith('--');
  })
  .join('\n')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

function run(stmt) {
  const file = path.join(__dirname, '_tmp_one.json');
  fs.writeFileSync(
    file,
    JSON.stringify({ resourceArn: CLUSTER_ARN, secretArn: SECRET_ARN, database: DATABASE, sql: stmt + ';' })
  );
  try {
    execSync(`aws rds-data execute-statement --cli-input-json file://${file} --region ${REGION}`, {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    console.log('OK', stmt.replace(/\s+/g, ' ').slice(0, 100));
  } catch (e) {
    console.error('FAIL', stmt.slice(0, 100));
    console.error((e.stderr || e.message || '').toString().slice(0, 600));
    process.exit(1);
  } finally {
    try {
      fs.unlinkSync(file);
    } catch (_) {}
  }
}

for (const stmt of statements) run(stmt);
console.log(`Applied ${statements.length} statement(s).`);
