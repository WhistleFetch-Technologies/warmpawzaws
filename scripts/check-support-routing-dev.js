#!/usr/bin/env node
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const CLUSTER_ID = `warmpawz-${ENVIRONMENT}-cluster`;

async function main() {
  const cluster = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${CLUSTER_ID} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  ).DBClusters[0];
  const secrets = JSON.parse(
    execSync(`aws secretsmanager list-secrets --region ${REGION} --output json`, { encoding: 'utf8' })
  ).SecretList;
  const secret = secrets.find((s) => s.Name && s.Name.includes(`warmpawz-${ENVIRONMENT}-rds-master`));
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

  console.log('Environment:', ENVIRONMENT);
  console.log('\n=== support_agents ===');
  console.log(
    JSON.stringify(
      await q(`
        SELECT sa.id, sa.user_id, sa.staff_id, sa.specialties, sa.availability_status,
               sa.is_active, sa.max_concurrent_tickets,
               COALESCE(a.name, s.name) AS name
        FROM support_agents sa
        LEFT JOIN admins a ON sa.user_id = a.id
        LEFT JOIN staff s ON sa.staff_id = s.id AND sa.user_id IS NULL
      `),
      null,
      2
    )
  );
  console.log('\n=== support_routing_settings ===');
  console.log(JSON.stringify(await q('SELECT * FROM support_routing_settings'), null, 2));
  console.log('\n=== recent unassigned tickets ===');
  console.log(
    JSON.stringify(
      await q(`
        SELECT id, subject, status, assigned_to, booking_id, category, created_at
        FROM support_tickets
        WHERE assigned_to IS NULL
        ORDER BY created_at DESC
        LIMIT 5
      `),
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
