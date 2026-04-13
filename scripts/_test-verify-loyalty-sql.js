const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const REGION = 'ap-south-1';
const BID = 'fe38c44e-b830-4b6a-b32a-9059c9c2f8c7';
function target() {
  const c = JSON.parse(execSync(`aws rds describe-db-clusters --db-cluster-identifier warmpawz-prod-cluster --region ${REGION} --output json`, { encoding: 'utf8' })).DBClusters[0];
  const s = JSON.parse(execSync(`aws secretsmanager describe-secret --secret-id warmpawz-prod-rds-master-20260207201049162400000001 --region ${REGION} --output json`, { encoding: 'utf8' }));
  return { resourceArn: c.DBClusterArn, secretArn: s.ARN, database: 'warmpawz' };
}
(async () => {
  const t = target();
  const client = new RDSDataClient({ region: REGION });
  const sql = `SELECT b.service_type, b.customer_id, b.total_amount, v.vendor_type,
              vs.service_name AS vs_name,
              COALESCE(sc.service_name, sc.display_name, s.name, vs.service_name) AS resolved_service_name,
              COALESCE(sc.category_name, s.category) AS resolved_category
             FROM bookings b
             LEFT JOIN vendors v ON b.vendor_id = v.id
             LEFT JOIN vendor_services vs ON b.service_id = vs.id
             LEFT JOIN service_catalog sc ON vs.service_id = sc.id
             LEFT JOIN services s ON vs.service_id = s.id
             WHERE b.id = '${BID}'::uuid`;
  try {
    const r = await client.send(new ExecuteStatementCommand({ ...t, sql, formatRecordsAs: 'JSON' }));
    console.log('OK', r.formattedRecords);
  } catch (e) {
    console.log('QUERY FAILED:', e.message);
  }
})();
