/**
 * Verify complete_pet_profile reward: RDS (prod) + AWS IAM/EventBridge/SQS/Lambda glue.
 *   node scripts/verify-complete-pet-profile-reward.js
 */
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const REGION = 'ap-south-1';
const PROD_CLUSTER = 'warmpawz-prod-cluster';
const PROD_SECRET = 'warmpawz-prod-rds-master-20260207201049162400000001';

function prodTarget() {
  const c = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${PROD_CLUSTER} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  ).DBClusters[0];
  const s = JSON.parse(
    execSync(`aws secretsmanager describe-secret --secret-id ${PROD_SECRET} --region ${REGION} --output json`, {
      encoding: 'utf8',
    })
  );
  return { resourceArn: c.DBClusterArn, secretArn: s.ARN, database: 'warmpawz' };
}

async function execJson(client, t, sql) {
  const r = await client.send(
    new ExecuteStatementCommand({ ...t, sql, formatRecordsAs: 'JSON' })
  );
  if (!r.formattedRecords) return [];
  return JSON.parse(r.formattedRecords);
}

function getByPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function mainSyncChecks() {
  const issues = [];
  const ok = [];

  // Simulate API success body (user-provided shape)
  const sampleRes = {
    success: true,
    pet: { customer_id: '35c53f7a-3692-47fe-b8d3-0b466831deb3', id: '442790c7-e32c-4308-bb15-d7d1978987c2' },
    message: 'Pet created successfully',
  };

  const pred = '$.success';
  const trimmed = pred.trim().toLowerCase();
  const passSuccess =
    trimmed.startsWith('$.') && !!getByPath(sampleRes, pred.replace(/^\$\./, ''));
  if (passSuccess) ok.push('success_predicate $.success matches POST /pets JSON');
  else issues.push('success_predicate $.success would not match sample response');

  const entityExpr = '$.pet.customer_id';
  const entityId = getByPath(sampleRes, entityExpr.replace(/^\$\./, ''));
  if (entityId && String(entityId).length > 30) ok.push(`entity_resolver resolves customer_id: ${entityId}`);
  else issues.push('entity_resolver $.pet.customer_id failed on sample');

  // Prod API role PutEvents
  try {
    const roleArn = JSON.parse(
      execSync(
        `aws lambda get-function-configuration --function-name warmpawz-prod-api-handler --region ${REGION} --output json`,
        { encoding: 'utf8' }
      )
    ).Role;
    const roleName = roleArn.split('/').pop();
    const policies = JSON.parse(
      execSync(`aws iam list-role-policies --role-name ${JSON.stringify(roleName)} --region ${REGION} --output json`, {
        encoding: 'utf8',
      })
    ).PolicyNames;
    const hasPut = policies.some((p) => /putevents/i.test(p));
    if (hasPut) ok.push(`prod API role has inline policy for PutEvents (${policies.filter((p) => /putevents/i.test(p)).join(', ')})`);
    else issues.push('prod API role: no obvious allow-putevents inline policy');
  } catch (e) {
    issues.push(`AWS Lambda/IAM check failed: ${e.message}`);
  }

  // EventBridge rule → prod queue
  try {
    const targets = JSON.parse(
      execSync(
        `aws events list-targets-by-rule --rule action-occurred-rule --event-bus-name default --region ${REGION} --output json`,
        { encoding: 'utf8' }
      )
    ).Targets;
    const arn = targets[0]?.Arn || '';
    if (arn.includes('loyalty-events-prod-queue')) ok.push('EventBridge action-occurred-rule → loyalty-events-prod-queue');
    else issues.push(`EventBridge targets unexpected: ${JSON.stringify(targets)}`);
  } catch (e) {
    issues.push(`EventBridge check failed: ${e.message}`);
  }

  // Consumer mapping
  try {
    const maps = JSON.parse(
      execSync(
        `aws lambda list-event-source-mappings --function-name warmpawz-prod-loyalty-events-consumer --region ${REGION} --output json`,
        { encoding: 'utf8' }
      )
    ).EventSourceMappings;
    const m = maps.find((x) => x.State === 'Enabled' && x.EventSourceArn?.includes('loyalty-events-prod-queue'));
    if (m) ok.push('warmpawz-prod-loyalty-events-consumer enabled on loyalty-events-prod-queue');
    else issues.push('Consumer SQS mapping missing or not Enabled');
  } catch (e) {
    issues.push(`Event source mapping check failed: ${e.message}`);
  }

  // Prod API EVENT_BUS
  try {
    const env = JSON.parse(
      execSync(
        `aws lambda get-function-configuration --function-name warmpawz-prod-api-handler --region ${REGION} --output json`,
        { encoding: 'utf8' }
      )
    ).Environment?.Variables || {};
    if (!env.EVENT_BUS_NAME || env.EVENT_BUS_NAME === 'default')
      ok.push('prod API uses default EventBridge bus (EVENT_BUS_NAME unset or default)');
    else ok.push(`prod API EVENT_BUS_NAME=${env.EVENT_BUS_NAME} (ensure rule exists on this bus)`);
  } catch (e) {
    issues.push(`Lambda env check failed: ${e.message}`);
  }

  return { ok, issues };
}

async function main() {
  const client = new RDSDataClient({ region: REGION });
  const t = prodTarget();

  console.log('=== 1. Prod RDS: loyalty_action_rules.complete_pet_profile ===\n');
  const rules = await execJson(
    client,
    t,
    `SELECT action_name, user_type, points_type, points_value, frequency_type, is_active, priority, description
     FROM loyalty_action_rules WHERE action_name = 'complete_pet_profile'`
  );
  console.log(JSON.stringify(rules, null, 2));
  const r0 = rules[0];
  if (!r0) console.log('FAIL: no rule row');
  else {
    if (String(r0.user_type) !== 'customer') console.log('FAIL: user_type should be customer');
    if (Number(r0.points_value) !== 100) console.log('WARN: points_value not 100');
    if (String(r0.frequency_type) !== 'one_time') console.log('WARN: frequency_type should be one_time for first-pet');
    if (r0.is_active !== true && r0.is_active !== 'true' && r0.is_active !== 't')
      console.log('FAIL: rule not active');
  }

  console.log('\n=== 2. Prod RDS: action_sources POST /pets ===\n');
  const src = await execJson(
    client,
    t,
    `SELECT id, route_pattern, method, action_name, success_predicate, entity_resolver, entity_type, enabled, dry_run, priority
     FROM action_sources
     WHERE method = 'POST' AND route_pattern = '/pets' AND action_name = 'complete_pet_profile'`
  );
  console.log(JSON.stringify(src, null, 2));
  const s0 = src[0];
  if (!s0) console.log('FAIL: no action_sources row for POST /pets + complete_pet_profile');
  else {
    if (String(s0.success_predicate || '').trim() !== '$.success') console.log('WARN: success_predicate not $.success');
    if (String(s0.entity_resolver || '').trim() !== '$.pet.customer_id')
      console.log('WARN: entity_resolver not $.pet.customer_id');
    if (String(s0.entity_type) !== 'customer') console.log('WARN: entity_type should be customer');
    if (s0.enabled === false || s0.enabled === 'false' || s0.enabled === 'f') console.log('FAIL: action_sources disabled');
    if (s0.dry_run === true || s0.dry_run === 'true' || s0.dry_run === 't') console.log('FAIL: dry_run is true');
  }

  console.log('\n=== 3. Prod RDS: loyalty_rules (active wallet policy) ===\n');
  const lr = await execJson(
    client,
    t,
    `SELECT rule_name, is_active, auto_convert_to_wallet, redemption_rate FROM loyalty_rules WHERE is_active = true LIMIT 5`
  );
  console.log(JSON.stringify(lr, null, 2));
  if (lr.length === 0) console.log('FAIL: no active loyalty_rules (consumer throws)');

  console.log('\n=== 4. Middleware + AWS glue (local simulation + CLI) ===\n');
  const { ok, issues } = mainSyncChecks();
  ok.forEach((x) => console.log('OK  ', x));
  issues.forEach((x) => console.log('ISSUE', x));

  console.log('\n=== Summary ===');
  const dbOk = !!(r0 && s0 && lr.length > 0);
  const awsOk = issues.length === 0;
  console.log(dbOk ? 'RDS config: OK for rule + action_source + active loyalty_rules' : 'RDS config: review failures above');
  console.log(awsOk ? 'AWS glue: OK' : 'AWS glue: review ISSUE lines');
  console.log('\nManual: POST /pets with auth, then check CloudWatch [ASDIAG] on warmpawz-prod-api-handler and loyalty_transactions for customer.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
