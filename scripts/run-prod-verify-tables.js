const fs = require('fs');
const { execSync } = require('child_process');
const base = {
  resourceArn: 'arn:aws:rds:ap-south-1:057442119249:cluster:warmpawz-prod-cluster',
  secretArn:
    'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-prod-rds-master-20260207201049162400000001-hmqkCE',
  database: 'warmpawz',
};
const sql = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('customer_referrals','action_sources','processed_events','loyalty_segments') ORDER BY 1`;
const out = 'd:/WFTPL/warmpawzApp/warmpawzaws/scripts/temp-prod-cli-one.json';
fs.writeFileSync(out, JSON.stringify({ ...base, sql, formatRecordsAs: 'JSON' }));
execSync(
  'aws rds-data execute-statement --cli-input-json file://d:/WFTPL/warmpawzApp/warmpawzaws/scripts/temp-prod-cli-one.json --region ap-south-1',
  { stdio: 'inherit' }
);
