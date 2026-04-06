const fs = require('fs');
const { execSync } = require('child_process');
const base = {
  resourceArn: 'arn:aws:rds:ap-south-1:057442119249:cluster:warmpawz-prod-cluster',
  secretArn:
    'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-prod-rds-master-20260207201049162400000001-hmqkCE',
  database: 'warmpawz',
};
const sql = `SELECT column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'loyalty_segments' AND column_name = 'id'`;
const out = 'd:/WFTPL/warmpawzApp/warmpawzaws/scripts/temp-prod-cli-one.json';
fs.writeFileSync(out, JSON.stringify({ ...base, sql, formatRecordsAs: 'JSON' }));
execSync(
  'aws rds-data execute-statement --cli-input-json file://d:/WFTPL/warmpawzApp/warmpawzaws/scripts/temp-prod-cli-one.json --region ap-south-1',
  { stdio: 'inherit' }
);
