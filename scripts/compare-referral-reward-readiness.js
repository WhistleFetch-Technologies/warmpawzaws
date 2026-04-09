/**
 * Dev vs prod RDS: tables/columns relevant to referral → ActionOccurred → loyalty consumer.
 */
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const REGION = 'ap-south-1';

const CLUSTERS = [
  ['DEV', 'warmpawz-dev-cluster', 'warmpawz-dev-rds-master-20260106164510791100000002'],
  ['PROD', 'warmpawz-prod-cluster', 'warmpawz-prod-rds-master-20260207201049162400000001'],
];

function target(clusterId, secretId) {
  const c = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  ).DBClusters[0];
  const s = JSON.parse(
    execSync(`aws secretsmanager describe-secret --secret-id ${secretId} --region ${REGION} --output json`, {
      encoding: 'utf8',
    })
  );
  return { resourceArn: c.DBClusterArn, secretArn: s.ARN, database: 'warmpawz' };
}

async function execJson(client, t, sql) {
  const r = await client.send(
    new ExecuteStatementCommand({ ...t, sql, formatRecordsAs: 'JSON' })
  );
  return r.formattedRecords ? JSON.parse(r.formattedRecords) : [];
}

async function main() {
  const client = new RDSDataClient({ region: REGION });

  for (const [label, cid, sid] of CLUSTERS) {
    const t = target(cid, sid);
    console.log(`\n======== ${label} ========`);

    const ltCols = await execJson(
      client,
      t,
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'loyalty_transactions'
       ORDER BY 1`
    );
    const names = ltCols.map((r) => r.column_name);
    console.log('loyalty_transactions columns:', names.join(', '));
    console.log('  has vendor_id:', names.includes('vendor_id'));

    const activeBasic = await execJson(
      client,
      t,
      `SELECT COUNT(*)::int AS n FROM loyalty_rules WHERE is_active = true`
    );
    console.log('loyalty_rules active count:', activeBasic[0]?.n ?? activeBasic[0]?.N);

    const rulesSample = await execJson(
      client,
      t,
      `SELECT rule_name, is_active, auto_convert_to_wallet, redemption_rate
       FROM loyalty_rules WHERE is_active = true`
    );
    console.log('active loyalty_rules rows:', JSON.stringify(rulesSample));

    const vendorReferralActions = await execJson(
      client,
      t,
      `SELECT action_name, user_type, is_active, priority
       FROM loyalty_action_rules
       WHERE action_name ILIKE '%vendor%refer%' OR action_name ILIKE '%refer%vendor%'
       ORDER BY action_name`
    );
    console.log('loyalty_action_rules (vendor/refer filter):', vendorReferralActions.length, 'rows');
    vendorReferralActions.slice(0, 15).forEach((r) =>
      console.log(' ', r.action_name, r.user_type, 'active=' + r.is_active)
    );

    const asVendor = await execJson(
      client,
      t,
      `SELECT action_name, enabled, route_pattern
       FROM action_sources
       WHERE action_name ILIKE '%vendor%refer%' OR action_name = 'vendor_refer_friend_who_joins'
       ORDER BY action_name`
    );
    console.log('action_sources (vendor refer / specific action):', JSON.stringify(asVendor));

    const pe = await execJson(client, t, `SELECT COUNT(*)::int AS n FROM processed_events`);
    console.log('processed_events count:', pe[0]?.n ?? pe[0]?.N);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
