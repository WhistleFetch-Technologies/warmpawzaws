#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const input = {
  resourceArn: 'arn:aws:rds:ap-south-1:057442119249:cluster:warmpawz-prod-cluster',
  secretArn:
    'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-prod-rds-master-20260207201049162400000001-hmqkCE',
  database: 'warmpawz',
  sql: `SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shipments'
    ORDER BY ordinal_position`,
};

const file = path.join(__dirname, '_tmp_query.json');
fs.writeFileSync(file, JSON.stringify(input));
const out = execSync(`aws rds-data execute-statement --cli-input-json file://${file} --region ap-south-1`, {
  encoding: 'utf8',
});
fs.unlinkSync(file);
const parsed = JSON.parse(out);
for (const r of parsed.records || []) {
  console.log(r[0].stringValue, r[1].stringValue);
}
