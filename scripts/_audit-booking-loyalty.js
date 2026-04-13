/**
 * Prod audit: one booking's verify loyalty context, action_sources predicate,
 * processed_events, loyalty rule conditions, broken legacy category join.
 * Usage: node _audit-booking-loyalty.js <booking_uuid>
 */
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const REGION = 'ap-south-1';
const BID = process.argv[2] || '54fbc51a-ddaf-4818-8db6-467370bdeef5';

function target() {
  const c = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier warmpawz-prod-cluster --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  ).DBClusters[0];
  const s = JSON.parse(
    execSync(
      `aws secretsmanager describe-secret --secret-id warmpawz-prod-rds-master-20260207201049162400000001 --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  );
  return { resourceArn: c.DBClusterArn, secretArn: s.ARN, database: 'warmpawz' };
}

async function run(client, t, label, sql) {
  try {
    const r = await client.send(new ExecuteStatementCommand({ ...t, sql, formatRecordsAs: 'JSON' }));
    console.log(label, r.formattedRecords || '[]');
  } catch (e) {
    console.log(label, 'FAILED:', e.message);
  }
}

(async () => {
  const t = target();
  const client = new RDSDataClient({ region: REGION });
  console.log('booking', BID, '\n');

  await run(
    client,
    t,
    '1_loyalty_context',
    `SELECT b.service_type, b.customer_id, b.total_amount, v.vendor_type,
       vs.service_name AS vs_name,
       COALESCE(sc.service_name, sc.display_name, s.name, vs.service_name) AS resolved_service_name,
       COALESCE(sc.category_name, s.category) AS resolved_category
     FROM bookings b
     LEFT JOIN vendors v ON b.vendor_id = v.id
     LEFT JOIN vendor_services vs ON b.service_id = vs.id
     LEFT JOIN service_catalog sc ON vs.service_id = sc.id
     LEFT JOIN services s ON vs.service_id = s.id
     WHERE b.id = '${BID}'::uuid`
  );

  await run(
    client,
    t,
    '2_legacy_category_join_bookings_to_services',
    `SELECT b.id, s.category, scn.category_name
     FROM bookings b
     JOIN services s ON b.service_id = s.id
     LEFT JOIN service_categories scn ON s.category_id = scn.id
     WHERE b.id = '${BID}'::uuid`
  );

  await run(
    client,
    t,
    '3_action_source_book_vet_verify',
    `SELECT success_predicate, enabled, dry_run, priority, notes
     FROM action_sources
     WHERE method = 'POST' AND route_pattern = '/razorpay/verify-payment' AND action_name = 'book_vet_consultation'`
  );

  await run(
    client,
    t,
    '4_processed_events_booking',
    `SELECT event_id, action_name, entity_id, reference_type, reference_id, created_at
     FROM processed_events
     WHERE reference_type = 'booking' AND reference_id = '${BID}'
     ORDER BY created_at DESC NULLS LAST
     LIMIT 20`
  );

  await run(
    client,
    t,
    '5_loyalty_rules_book_vet',
    `SELECT action_name, is_active, conditions, points_value, points_type
     FROM loyalty_action_rules
     WHERE action_name = 'book_vet_consultation' AND is_active = true`
  );

  await run(
    client,
    t,
    '6_loyalty_txn_booking',
    `SELECT lt.id, lt.points, lt.reference_type, lt.reference_id, lt.description, lt.created_at
     FROM loyalty_transactions lt
     WHERE lt.reference_type = 'booking' AND lt.reference_id = '${BID}'
     ORDER BY lt.created_at DESC NULLS LAST
     LIMIT 10`
  );
})();
