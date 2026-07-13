const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const REGION = 'ap-south-1';

function cell(f) {
  if (!f || f.isNull) return null;
  return f.stringValue ?? f.longValue ?? f.doubleValue ?? null;
}
function rows(r) {
  const c = (r.columnMetadata || []).map((x) => x.name);
  return (r.records || []).map((rec) => {
    const o = {};
    rec.forEach((f, i) => {
      o[c[i]] = cell(f);
    });
    return o;
  });
}

(async () => {
  const ci = JSON.parse(
    execSync(
      'aws rds describe-db-clusters --db-cluster-identifier warmpawz-prod-cluster --region ap-south-1 --output json',
      { encoding: 'utf8' }
    )
  );
  const cl = ci.DBClusters[0];
  const sm = new SecretsManagerClient({ region: REGION });
  const sec = await sm.send(
    new GetSecretValueCommand({ SecretId: 'warmpawz-prod-rds-master-20260207201049162400000001' })
  );
  const meta = { resourceArn: cl.DBClusterArn, secretArn: sec.ARN, database: 'warmpawz' };
  const client = new RDSDataClient({ region: REGION });
  const q = async (sql) => {
    const res = await client.send(
      new ExecuteStatementCommand({ ...meta, sql, includeResultMetadata: true })
    );
    return rows(res);
  };

  const count = await q(`
    SELECT COUNT(*)::int AS total
    FROM service_catalog
    WHERE TRIM(category_name) = 'General'
  `);

  const services = await q(`
    SELECT
      id::text,
      service_id,
      service_name,
      display_name,
      category_id,
      category_name,
      service_style,
      status,
      publish_status,
      base_price,
      created_at::text
    FROM service_catalog
    WHERE TRIM(category_name) = 'General'
    ORDER BY service_name ASC, created_at ASC
  `);

  console.log(JSON.stringify({ total: count[0]?.total ?? 0, services }, null, 2));
})().catch((e) => {
  console.error('QUERY_FAILED:', e.message || e);
  process.exit(1);
});
