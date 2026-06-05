const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { execSync } = require('child_process');
const REGION = 'ap-south-1';
const t = (() => {
  const c = JSON.parse(execSync('aws rds describe-db-clusters --db-cluster-identifier warmpawz-dev-cluster --region ap-south-1 --output json', { encoding: 'utf8' })).DBClusters[0];
  const s = JSON.parse(execSync('aws secretsmanager describe-secret --secret-id warmpawz-dev-rds-master-20260106164510791100000002 --region ap-south-1 --output json', { encoding: 'utf8' }));
  return { resourceArn: c.DBClusterArn, secretArn: s.ARN, database: 'warmpawz' };
})();
async function q(sql) {
  const r = await new RDSDataClient({ region: REGION }).send(new ExecuteStatementCommand({ ...t, sql, formatRecordsAs: 'JSON' }));
  return JSON.parse(r.formattedRecords || '[]');
}
(async () => {
  for (const last10 of ['8792100627', '8296974568']) {
    const rows = await q(`SELECT id, phone, full_name, created_at FROM customers WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = '${last10}' ORDER BY created_at`);
    console.log('last10', last10, JSON.stringify(rows, null, 2));
  }
})().catch((e) => { console.error(e); process.exit(1); });
