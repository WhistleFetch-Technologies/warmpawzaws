/**
 * Ensure exactly one active row in loyalty_rules (basic / platform rule).
 * Keeps: rule_name 'Standard' if present and active or any row, else 'default_earn_rule', else most recently updated row.
 * Dry-run: node normalize-loyalty-rules-single-active.js
 * Apply:   node normalize-loyalty-rules-single-active.js --apply
 *
 * Targets: warmpawz-dev-cluster and warmpawz-prod-cluster (ap-south-1).
 */
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const REGION = 'ap-south-1';
const APPLY = process.argv.includes('--apply');

const CLUSTERS = [
  { label: 'DEV', id: 'warmpawz-dev-cluster', secretId: 'warmpawz-dev-rds-master-20260106164510791100000002' },
  { label: 'PROD', id: 'warmpawz-prod-cluster', secretId: 'warmpawz-prod-rds-master-20260207201049162400000001' },
];

function resolveTarget(clusterId, secretId) {
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
  return {
    resourceArn: c.DBClusterArn,
    secretArn: s.ARN,
    database: c.DatabaseName || 'warmpawz',
  };
}

function parseRecords(formattedRecords) {
  if (!formattedRecords) return [];
  return JSON.parse(formattedRecords);
}

/** Pick exactly one id to remain active. */
function chooseKeeper(rows) {
  const byName = (n) => rows.find((r) => r.rule_name === n);
  if (byName('Standard')) return byName('Standard').id;
  if (byName('default_earn_rule')) return byName('default_earn_rule').id;
  const active = rows.filter((r) => r.is_active === true || r.is_active === 'true' || r.is_active === 't');
  if (active.length === 1) return active[0].id;
  if (active.length > 1) {
    active.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
    return active[0].id;
  }
  rows.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  return rows[0].id;
}

async function runCluster(label, clusterId, secretId) {
  const t = resolveTarget(clusterId, secretId);
  const client = new RDSDataClient({ region: REGION });

  const list = await client.send(
    new ExecuteStatementCommand({
      ...t,
      sql: `SELECT id, rule_name, is_active, updated_at FROM loyalty_rules ORDER BY rule_name`,
      formatRecordsAs: 'JSON',
    })
  );
  const rows = parseRecords(list.formattedRecords);
  console.log(`\n======== ${label} (${rows.length} rows) ========`);
  rows.forEach((r) => console.log(`  ${r.rule_name} | active=${r.is_active} | ${r.id}`));

  if (rows.length === 0) {
    console.log('  (no rows — skip)');
    return;
  }

  const keeperId = chooseKeeper(rows);
  const keeper = rows.find((r) => r.id === keeperId);
  console.log(`  → keep active: "${keeper?.rule_name}" (${keeperId})`);

  const others = rows.filter((r) => r.id !== keeperId);
  const needDeactivate = others.filter(
    (r) => r.is_active === true || r.is_active === 'true' || r.is_active === 't'
  );
  const needActivate = !(
    keeper.is_active === true || keeper.is_active === 'true' || keeper.is_active === 't'
  );

  if (needDeactivate.length === 0 && !needActivate) {
    console.log('  Already exactly one active rule; no updates.');
    return;
  }

  if (!APPLY) {
    console.log('  DRY-RUN: would deactivate:', needDeactivate.map((r) => r.rule_name).join(', ') || '(none)');
    if (needActivate) console.log('  DRY-RUN: would set keeper active=true');
    return;
  }

  for (const r of needDeactivate) {
    await client.send(
      new ExecuteStatementCommand({
        ...t,
        sql: `UPDATE loyalty_rules SET is_active = false, updated_at = NOW() WHERE id = '${r.id}'::uuid`,
      })
    );
    console.log(`  Deactivated: ${r.rule_name}`);
  }

  if (needActivate) {
    await client.send(
      new ExecuteStatementCommand({
        ...t,
        sql: `UPDATE loyalty_rules SET is_active = true, updated_at = NOW() WHERE id = '${keeperId}'::uuid`,
      })
    );
    console.log(`  Activated keeper: ${keeper.rule_name}`);
  }

  const verify = await client.send(
    new ExecuteStatementCommand({
      ...t,
      sql: `SELECT rule_name, is_active FROM loyalty_rules WHERE is_active = true`,
      formatRecordsAs: 'JSON',
    })
  );
  const v = parseRecords(verify.formattedRecords);
  console.log(`  Verify active count: ${v.length}`, v.map((x) => x.rule_name).join(', '));
}

async function main() {
  console.log(APPLY ? 'MODE: APPLY' : 'MODE: DRY-RUN (add --apply to execute)');
  for (const c of CLUSTERS) {
    await runCluster(c.label, c.id, c.secretId);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
