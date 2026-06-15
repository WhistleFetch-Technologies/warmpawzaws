#!/usr/bin/env node
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { execSync } = require('child_process');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const ticketId = process.argv[2] || 'd2ca5385-c930-4f99-b1ab-339836a2f926';

async function main() {
  const cluster = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier warmpawz-dev-cluster --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  ).DBClusters[0];
  const secrets = JSON.parse(
    execSync(`aws secretsmanager list-secrets --region ${REGION} --output json`, { encoding: 'utf8' })
  ).SecretList;
  const secret = secrets.find((s) => s.Name && s.Name.includes('warmpawz-dev-rds-master'));
  const client = new RDSDataClient({ region: REGION });

  async function q(sql) {
    const r = await client.send(
      new ExecuteStatementCommand({
        resourceArn: cluster.DBClusterArn,
        secretArn: secret.ARN,
        database: 'warmpawz',
        sql,
        includeResultMetadata: true,
      })
    );
    const cols = (r.columnMetadata || []).map((c) => c.name);
    return (r.records || []).map((rec) =>
      Object.fromEntries(rec.map((v, i) => [cols[i], Object.values(v)[0] ?? null]))
    );
  }

  console.log('Ticket:', ticketId);
  console.log(JSON.stringify(await q(`SELECT id, status, assigned_to::text, booking_id::text, category, ai_ack_success FROM support_tickets WHERE id = '${ticketId}'`), null, 2));
  console.log('Attachments:', JSON.stringify(await q(`SELECT metadata->'attachments' AS att FROM support_tickets WHERE id = '${ticketId}'`), null, 2));
  console.log('Agent workloads:', JSON.stringify(await q(`
    SELECT sa.id::text, COALESCE(a.name, s.name) AS name, sa.availability_status,
           sa.specialties::text, sa.max_concurrent_tickets,
           (SELECT COUNT(*)::int FROM support_tickets t
            WHERE t.assigned_to = COALESCE(sa.user_id, sa.staff_id)
              AND t.status NOT IN ('closed', 'resolved', 'cancelled')) AS workload
    FROM support_agents sa
    LEFT JOIN admins a ON sa.user_id = a.id
    LEFT JOIN staff s ON sa.staff_id = s.id AND sa.user_id IS NULL
    WHERE sa.is_active = true
  `), null, 2));
  console.log('Booking pool agents:', JSON.stringify(await q(`
    SELECT sa.id::text, COALESCE(a.name, s.name) AS name, sa.availability_status,
           sa.specialties @> ARRAY['booking']::text[] AS has_booking
    FROM support_agents sa
    LEFT JOIN admins a ON sa.user_id = a.id
    LEFT JOIN staff s ON sa.staff_id = s.id AND sa.user_id IS NULL
    WHERE sa.is_active = true
      AND (sa.availability_status IS NULL OR sa.availability_status IN ('available', 'online'))
      AND sa.specialties @> ARRAY['booking']::text[]
  `), null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
