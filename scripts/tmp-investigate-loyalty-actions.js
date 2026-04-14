const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const REGION = 'ap-south-1';
const NAMES = [
  'update_health_record',
  'buy_medicine',
  'refer_friend',
  'buy_insurance',
  'renew_insurance',
  'book_grooming',
  'book_vet_consultation',
  'purchase_pet_food',
  'book_nutrition_consultation',
  'post_review',
  'birthday_month_booking',
  'buy_first_product',
  'buy_product',
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

async function run(client, t, sql) {
  const r = await client.send(
    new ExecuteStatementCommand({ ...t, sql, formatRecordsAs: 'JSON' })
  );
  return r.formattedRecords ? JSON.parse(r.formattedRecords) : [];
}

async function main() {
  const client = new RDSDataClient({ region: REGION });
  const list = NAMES.map((n) => `'${n.replace(/'/g, "''")}'`).join(', ');
  const sqlRules = `SELECT action_name, is_active, points_type, points_value, base_amount, frequency_type, frequency_limit
    FROM loyalty_action_rules WHERE action_name IN (${list}) ORDER BY action_name`;
  const sqlSources = `SELECT method, route_pattern, action_name, enabled, entity_resolver, amount_resolver, success_predicate
    FROM action_sources WHERE action_name IN (${list}) ORDER BY action_name, route_pattern`;

  for (const [label, clusterId, secretId] of [
    ['DEV', 'warmpawz-dev-cluster', 'warmpawz-dev-rds-master-20260106164510791100000002'],
    ['PROD', 'warmpawz-prod-cluster', 'warmpawz-prod-rds-master-20260207201049162400000001'],
  ]) {
    const t = target(clusterId, secretId);
    console.log(`\n======== ${label} loyalty_action_rules ========`);
    console.log(JSON.stringify(await run(client, t, sqlRules), null, 2));
    console.log(`\n======== ${label} action_sources ========`);
    console.log(JSON.stringify(await run(client, t, sqlSources), null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
