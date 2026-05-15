#!/usr/bin/env node
/** Same checks as verify-prod-loyalty-readiness.js but for warmpawz-dev-cluster. */
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const DEV_CLUSTER = 'warmpawz-dev-cluster';
const DEV_SECRET = 'warmpawz-dev-rds-master-20260106164510791100000002';

const TABLES_PIPELINE = [
  'action_sources',
  'processed_events',
  'loyalty_segments',
  'customer_segment_assignments',
  'vendor_segment_assignments',
  'loyalty_action_rules',
  'customer_loyalty_points',
  'loyalty_transactions',
  'customer_wallets',
  'wallet_transactions',
];
const TABLES_VENDOR_WALLET = ['vendor_wallets', 'vendor_wallet_transactions'];
const TABLES_REFERRALS = ['customer_referrals', 'vendor_referrals'];
const TABLES_TIERS = ['customer_tiers', 'vendor_tier_subscriptions'];
const ALL_CHECKED = [...TABLES_PIPELINE, ...TABLES_VENDOR_WALLET, ...TABLES_REFERRALS, ...TABLES_TIERS];

function resolveDev() {
  const clusterJson = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${DEV_CLUSTER} --region ${REGION} --output json`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] }
    )
  );
  const c = clusterJson.DBClusters?.[0];
  if (!c) throw new Error(`Cluster not found: ${DEV_CLUSTER}`);
  const secretJson = JSON.parse(
    execSync(
      `aws secretsmanager describe-secret --secret-id "${DEV_SECRET}" --region ${REGION} --output json`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] }
    )
  );
  return {
    resourceArn: c.DBClusterArn,
    secretArn: secretJson.ARN,
    database: c.DatabaseName || 'warmpawz',
  };
}

async function execJson(client, target, sql) {
  const r = await client.send(
    new ExecuteStatementCommand({
      resourceArn: target.resourceArn,
      secretArn: target.secretArn,
      database: target.database,
      sql,
      formatRecordsAs: 'JSON',
    })
  );
  if (!r.formattedRecords) return [];
  return JSON.parse(r.formattedRecords);
}

function isPresent(row) {
  return row.present === true || row.present === 'true' || row.present === 't';
}

async function main() {
  const target = resolveDev();
  const client = new RDSDataClient({ region: REGION });
  const inList = ALL_CHECKED.map((t) => `'${t.replace(/'/g, "''")}'`).join(', ');
  const presenceSql = `
SELECT expected.table_name,
       (t.table_name IS NOT NULL) AS present
FROM unnest(ARRAY[${inList}]::text[]) AS expected(table_name)
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public' AND t.table_name = expected.table_name
ORDER BY expected.table_name
`;
  const presence = await execJson(client, target, presenceSql);
  const byName = Object.fromEntries(presence.map((r) => [r.table_name, isPresent(r)]));
  for (const name of ALL_CHECKED) {
    console.log(`${byName[name] ? 'OK  ' : 'MISS'}  ${name}`);
  }
  const colSql = `
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'referrals' AND column_name = 'referred_vendor_id'
`;
  const cols = await execJson(client, target, colSql);
  console.log('\nreferrals.referred_vendor_id:', cols.length ? 'present' : 'MISSING');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
