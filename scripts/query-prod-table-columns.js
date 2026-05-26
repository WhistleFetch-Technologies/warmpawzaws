#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const tables = process.argv.slice(2);
if (!tables.length) {
  console.error('Usage: node query-prod-table-columns.js table1 table2 ...');
  process.exit(1);
}

const base = {
  resourceArn: 'arn:aws:rds:ap-south-1:057442119249:cluster:warmpawz-prod-cluster',
  secretArn:
    'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-prod-rds-master-20260207201049162400000001-hmqkCE',
  database: 'warmpawz',
};

function query(sql) {
  const file = path.join(__dirname, '_tmp_query.json');
  fs.writeFileSync(file, JSON.stringify({ ...base, sql }));
  const out = execSync(`aws rds-data execute-statement --cli-input-json file://${file} --region ap-south-1`, {
    encoding: 'utf8',
  });
  fs.unlinkSync(file);
  return JSON.parse(out).records || [];
}

for (const table of tables) {
  console.log(`\n=== ${table} ===`);
  const rows = query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}' ORDER BY ordinal_position`
  );
  for (const r of rows) console.log(' ', r[0].stringValue);
}
