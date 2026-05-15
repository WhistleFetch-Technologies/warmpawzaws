#!/usr/bin/env node
/**
 * Prod RDS: verify tables + minimum data for loyalty/rewards pipeline.
 *
 *   node scripts/verify-prod-loyalty-readiness.js
 */

const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const PROD_CLUSTER = 'warmpawz-prod-cluster';
const PROD_SECRET = 'warmpawz-prod-rds-master-20260207201049162400000001';

/** HTTP → ActionOccurred → consumer → points (customer entity). */
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

/** Vendor referral / vendor-side awards (loyalty-points-service vendor branch). */
const TABLES_VENDOR_WALLET = ['vendor_wallets', 'vendor_wallet_transactions'];

/** Referral rows used by referral-service + consumer. */
const TABLES_REFERRALS = ['customer_referrals', 'vendor_referrals'];

/** Tier lookups for rules / segmentation (queries fail if missing and code path hits them). */
const TABLES_TIERS = ['customer_tiers', 'vendor_tier_subscriptions'];

const ALL_CHECKED = [...TABLES_PIPELINE, ...TABLES_VENDOR_WALLET, ...TABLES_REFERRALS, ...TABLES_TIERS];

function resolveProd() {
  const clusterJson = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${PROD_CLUSTER} --region ${REGION} --output json`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] }
    )
  );
  const c = clusterJson.DBClusters?.[0];
  if (!c) throw new Error(`Cluster not found: ${PROD_CLUSTER}`);
  const secretJson = JSON.parse(
    execSync(
      `aws secretsmanager describe-secret --secret-id "${PROD_SECRET}" --region ${REGION} --output json`,
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
  const target = resolveProd();
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

  function printGroup(title, names) {
    console.log(`\n=== ${title} ===`);
    for (const name of names) {
      const ok = byName[name];
      console.log(`${ok ? 'OK  ' : 'MISS'}  ${name}`);
    }
  }

  printGroup('Pipeline + customer wallets', TABLES_PIPELINE);
  printGroup('Vendor wallet (vendor loyalty payouts)', TABLES_VENDOR_WALLET);
  printGroup('Referrals', TABLES_REFERRALS);
  printGroup('Tier tables (segment / rule helpers)', TABLES_TIERS);

  const pipelineOk = TABLES_PIPELINE.every((n) => byName[n]);
  const vendorWalletOk = TABLES_VENDOR_WALLET.every((n) => byName[n]);
  const referralsOk = TABLES_REFERRALS.every((n) => byName[n]);
  const tiersOk = TABLES_TIERS.every((n) => byName[n]);

  const countSpecs = [
    ['loyalty_segments', 'SELECT COUNT(*)::int AS n FROM loyalty_segments'],
    ['loyalty_action_rules', 'SELECT COUNT(*)::int AS n FROM loyalty_action_rules'],
    ['loyalty_action_rules_active', "SELECT COUNT(*)::int AS n FROM loyalty_action_rules WHERE is_active = true"],
    ['action_sources', 'SELECT COUNT(*)::int AS n FROM action_sources'],
    ['action_sources_enabled', 'SELECT COUNT(*)::int AS n FROM action_sources WHERE enabled = true'],
    ['processed_events', 'SELECT COUNT(*)::int AS n FROM processed_events'],
  ];

  console.log('\n=== Row counts (sanity) ===');
  let countsOk = true;
  for (const [label, sql] of countSpecs) {
    try {
      const rows = await execJson(client, target, sql);
      const n = rows[0]?.n ?? rows[0]?.N;
      console.log(`${label}: ${n}`);
      if (label === 'loyalty_segments' && Number(n) < 1) countsOk = false;
      if (label === 'loyalty_action_rules' && Number(n) < 1) countsOk = false;
      if (label === 'action_sources_enabled' && Number(n) < 1) countsOk = false;
    } catch (e) {
      console.log(`${label}: ERROR — ${e.message || e}`);
      countsOk = false;
    }
  }

  console.log('\n=== Summary ===');
  if (pipelineOk && countsOk) {
    console.log('Customer/event pipeline: READY (segments, rules, action_sources, customer wallets).');
  } else {
    console.log('Customer/event pipeline: NOT READY — fix missing tables or zero counts above.');
  }
  if (vendorWalletOk) {
    console.log('Vendor wallet payouts: READY.');
  } else {
    console.log(
      'Vendor wallet payouts: NOT READY — create vendor_wallets + vendor_wallet_transactions (or run the migration that adds them) before vendor-side loyalty awards.'
    );
  }
  if (referralsOk) {
    console.log('Referral tables: present.');
  } else {
    console.log('Referral tables: incomplete — vendor/customer referral flows need customer_referrals + vendor_referrals.');
  }
  if (tiersOk) {
    console.log('Tier tables: present.');
  } else {
    console.log(
      'Tier tables: missing — tier-based segments/rules may error when evaluated; add customer_tiers / vendor_tier_subscriptions if you use those features.'
    );
  }

  const fullyReady = pipelineOk && vendorWalletOk && referralsOk && tiersOk && countsOk;
  if (fullyReady) {
    console.log('\nOverall: prod schema looks complete for loyalty and rewards (customer + vendor).');
    process.exit(0);
  }
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
