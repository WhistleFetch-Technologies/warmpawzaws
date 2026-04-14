/**
 * Investigate vendor referral reward path for specific vendors / code (RDS Data API).
 * Usage: node investigate-vendor-referral-prod.js
 */
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const REGION = 'ap-south-1';
const REFERRED_VENDOR = '8d3eccc3-f8b2-4971-9748-e7f8533be0b1';
const REFERRER_VENDOR = '2ef165bd-9b9d-4dab-aab0-68548e33b7e1';
const CODE = 'VENDORB7E1V8OQ';

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

async function run(client, t, label, sql) {
  try {
    const r = await client.send(
      new ExecuteStatementCommand({ ...t, sql, formatRecordsAs: 'JSON' })
    );
    const rows = r.formattedRecords ? JSON.parse(r.formattedRecords) : [];
    console.log(`\n--- ${label} (${rows.length} rows) ---`);
    console.log(JSON.stringify(rows, null, 2));
    return rows;
  } catch (e) {
    console.log(`\n--- ${label} ERROR ---`, e.message);
    return [];
  }
}

async function main() {
  const prod = target('warmpawz-prod-cluster', 'warmpawz-prod-rds-master-20260207201049162400000001');
  const dev = target('warmpawz-dev-cluster', 'warmpawz-dev-rds-master-20260106164510791100000002');
  const client = new RDSDataClient({ region: REGION });

  console.log('\n########## PROD PHONE / IDENTITY ##########');
  await run(
    client,
    prod,
    'vendor_referrals + referred_phone',
    `SELECT id, referred_phone, referred_vendor_id, status, created_at
     FROM vendor_referrals
     WHERE UPPER(TRIM(referral_code)) = UPPER(TRIM('${CODE.replace(/'/g, "''")}'))`
  );
  await run(
    client,
    prod,
    'vendor_identity for TEST vendor',
    `SELECT id, phone, vendor_id, onboarding_status, metadata
     FROM vendor_identity
     WHERE vendor_id = '${REFERRED_VENDOR}'::uuid
     LIMIT 3`
  );

  for (const [name, t] of [
    ['PROD', prod],
    ['DEV', dev],
  ]) {
    console.log(`\n########## ${name} ##########`);
    await run(
      client,
      t,
      'action_sources routes containing onboarding or application approve',
      `SELECT method, route_pattern, action_name, enabled
       FROM action_sources
       WHERE route_pattern ILIKE '%vendor%onboard%'
          OR route_pattern ILIKE '%application%approve%'
       ORDER BY route_pattern`
    );
    await run(
      client,
      t,
      'vendor_referrals for code',
      `SELECT id, referrer_vendor_id, referred_vendor_id, referral_code, status, created_at, approved_at
       FROM vendor_referrals
       WHERE UPPER(TRIM(referral_code)) = UPPER(TRIM('${CODE.replace(/'/g, "''")}'))
       ORDER BY created_at DESC
       LIMIT 5`
    );
    await run(
      client,
      t,
      'vendor_referrals referred_vendor',
      `SELECT id, referrer_vendor_id, referred_vendor_id, referral_code, status, created_at
       FROM vendor_referrals
       WHERE referred_vendor_id = '${REFERRED_VENDOR}'::uuid
          OR referrer_vendor_id = '${REFERRER_VENDOR}'::uuid
       ORDER BY created_at DESC
       LIMIT 10`
    );
    await run(
      client,
      t,
      'loyalty_transactions vendor_referral for referrer',
      `SELECT lt.id, lt.vendor_id, lt.customer_id, lt.points, lt.reference_type, lt.reference_id::text AS reference_id, lt.description, lt.created_at
       FROM loyalty_transactions lt
       WHERE lt.reference_type = 'vendor_referral'
         AND lt.vendor_id = '${REFERRER_VENDOR}'::uuid
       ORDER BY lt.created_at DESC
       LIMIT 10`
    );
    await run(
      client,
      t,
      'loyalty_transactions vendor_referral ref join VR for this referral row',
      `SELECT lt.id, lt.vendor_id, lt.points, lt.reference_id::text, vr.referral_code, vr.status, vr.referrer_vendor_id
       FROM loyalty_transactions lt
       JOIN vendor_referrals vr ON lt.reference_id::text = vr.id::text
       WHERE vr.referral_code ILIKE '${CODE.replace(/'/g, "''")}'
       LIMIT 10`
    );
    await run(
      client,
      t,
      'action_sources vendor_refer_friend_who_joins',
      `SELECT id, method, route_pattern, action_name, enabled, entity_type, reference_type
       FROM action_sources
       WHERE action_name = 'vendor_refer_friend_who_joins'
       ORDER BY enabled DESC, route_pattern`
    );
    await run(
      client,
      t,
      'loyalty_action_rules vendor_refer_friend_who_joins',
      `SELECT action_name, user_type, points_type, points_value, is_active, priority
       FROM loyalty_action_rules
       WHERE action_name = 'vendor_refer_friend_who_joins'`
    );
  }

}

main().catch(console.error);
