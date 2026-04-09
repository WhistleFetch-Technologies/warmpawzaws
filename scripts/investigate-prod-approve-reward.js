/**
 * Prod: vendor 8d3eccc3... approve path — RDS + action_sources resolvers
 */
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const REGION = 'ap-south-1';
const VENDOR_ID = '8d3eccc3-f8b2-4971-9748-e7f8533be0b1';
const REFERRER = '2ef165bd-9b9d-4dab-aab0-68548e33b7e1';

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
    const r = await client.send(new ExecuteStatementCommand({ ...t, sql, formatRecordsAs: 'JSON' }));
    const rows = r.formattedRecords ? JSON.parse(r.formattedRecords) : [];
    console.log(`\n--- ${label} (${rows.length}) ---`);
    console.log(JSON.stringify(rows, null, 2));
    return rows;
  } catch (e) {
    console.log(`\n--- ${label} ERROR ---`, e.message);
    return [];
  }
}

async function main() {
  const prod = target('warmpawz-prod-cluster', 'warmpawz-prod-rds-master-20260207201049162400000001');
  const client = new RDSDataClient({ region: REGION });

  await run(
    client,
    prod,
    'action_sources for application approve (full)',
    `SELECT id, action_name, success_predicate, entity_resolver, entity_type, reference_type, reference_id_resolver, enabled
     FROM action_sources
     WHERE route_pattern = '/admin/vendor/application/:applicationId/approve'
     ORDER BY action_name`
  );

  await run(
    client,
    prod,
    'vendor_referrals for referred vendor or code VENDORB7E1V8OQ',
    `SELECT id, referrer_vendor_id, referred_vendor_id, referred_phone, referral_code, status, applied_at, approved_at
     FROM vendor_referrals
     WHERE referred_vendor_id = '${VENDOR_ID}'::uuid
        OR referral_code = 'VENDORB7E1V8OQ'
     ORDER BY created_at DESC`
  );

  await run(
    client,
    prod,
    'loyalty_transactions vendor_referral for referrer',
    `SELECT id, vendor_id, customer_id, points, reference_type, reference_id::text, description, created_at
     FROM loyalty_transactions
     WHERE reference_type = 'vendor_referral' AND vendor_id = '${REFERRER}'::uuid
     ORDER BY created_at DESC LIMIT 15`
  );

  await run(
    client,
    prod,
    'loyalty_transactions for new vendor (any ref)',
    `SELECT id, vendor_id, customer_id, points, reference_type, reference_id::text, description, created_at
     FROM loyalty_transactions
     WHERE vendor_id = '${VENDOR_ID}'::uuid
     ORDER BY created_at DESC LIMIT 15`
  );

  await run(
    client,
    prod,
    'loyalty_action_rules vendor_signup_complete_profile + vendor_refer_friend',
    `SELECT action_name, user_type, points_value, is_active FROM loyalty_action_rules
     WHERE action_name IN ('vendor_signup_complete_profile','vendor_refer_friend_who_joins')
     ORDER BY action_name`
  );

  await run(
    client,
    prod,
    'processed_events recent (sample)',
    `SELECT event_id, created_at FROM processed_events ORDER BY created_at DESC NULLS LAST LIMIT 8`
  );

  console.log('\n--- CLI: EventBridge rules on default bus (ActionOccurred / loyalty) ---');
  try {
    const rules = JSON.parse(
      execSync(
        `aws events list-rules --event-bus-name default --region ${REGION} --output json`,
        { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
      )
    );
    const names = (rules.Rules || [])
      .map((r) => r.Name)
      .filter((n) => /loyalty|action|warmpawz|occurred/i.test(n));
    console.log(JSON.stringify(names, null, 2));
    for (const name of names.slice(0, 8)) {
      const targs = JSON.parse(
        execSync(
          `aws events list-targets-by-rule --rule ${JSON.stringify(name)} --event-bus-name default --region ${REGION} --output json`,
          { encoding: 'utf8' }
        )
      );
      console.log(`\nTargets for ${name}:`, JSON.stringify(targs.Targets?.map((t) => ({ Id: t.Id, Arn: t.Arn })) || [], null, 2));
    }
  } catch (e) {
    console.log('EventBridge list error:', e.message);
  }

  console.log('\n--- CLI: find prod API + loyalty lambdas ---');
  try {
    const out = execSync(
      `aws lambda list-functions --region ${REGION} --output json --query "Functions[?contains(FunctionName, 'warmpawz') && contains(FunctionName, 'prod')].[FunctionName]"`,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );
    const fns = JSON.parse(out);
    const interesting = (fns || []).flat().filter((n) => /api-handler|loyalty-events/i.test(n));
    console.log(JSON.stringify(interesting, null, 2));
    for (const fn of interesting) {
      const cfg = JSON.parse(
        execSync(`aws lambda get-function-configuration --function-name ${JSON.stringify(fn)} --region ${REGION} --output json`, {
          encoding: 'utf8',
        })
      );
      const env = cfg.Environment?.Variables || {};
      console.log(`\n${fn} EVENT_BUS_NAME=${env.EVENT_BUS_NAME || '(unset)'} SQS=${env.LOYALTY_QUEUE_URL || env.LOYALTY_EVENTS_QUEUE_URL || '(none)'}`);
    }
  } catch (e) {
    console.log('Lambda list error:', e.message);
  }
}

main().catch(console.error);
