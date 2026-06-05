#!/usr/bin/env node
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const CASE_ID = 'd0312692-9106-49ac-a784-9cc561a529f8';
const REGION = 'ap-south-1';
const clusterInfo = JSON.parse(
  execSync('aws rds describe-db-clusters --db-cluster-identifier warmpawz-prod-cluster --region ap-south-1 --output json', {
    encoding: 'utf8',
  }),
);
const clusterArn = clusterInfo.DBClusters[0].DBClusterArn;
const secretArn =
  clusterInfo.DBClusters[0].MasterUserSecret?.SecretArn ||
  JSON.parse(
    execSync(
      'aws secretsmanager describe-secret --secret-id warmpawz-prod-rds-master-20260207201049162400000001 --region ap-south-1 --output json',
      { encoding: 'utf8' },
    ),
  ).ARN;
const client = new RDSDataClient({ region: REGION });

async function q(sql) {
  const res = await client.send(
    new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn,
      database: 'warmpawz',
      sql,
      includeResultMetadata: true,
    }),
  );
  const cols = (res.columnMetadata || []).map((c) => c.name);
  const cellVal = (c) => (!c || c.isNull ? null : Object.values(c)[0] ?? null);
  return (res.records || []).map((row) =>
    Object.fromEntries(row.map((cell, i) => [cols[i], cellVal(cell)])),
  );
}

async function main() {
  console.log(await q(`
    SELECT mrc.status, mrc.refund_failure_reason, mrc.recommended_refund_amount::text,
           mo.order_number, mo.payment_status, mo.razorpay_payment_id,
           mo.customer_id::text, LEFT(mo.purchase_snapshot::text, 800) AS purchase_snapshot
    FROM meal_refund_cases mrc
    JOIN meal_orders mo ON mo.id = mrc.meal_order_id
    WHERE mrc.id = '${CASE_ID}'::uuid
  `));
  console.log('tables', await q(`
    SELECT to_regclass('customer_wallets')::text AS customer_wallets,
           to_regclass('wallets')::text AS wallets
  `));
  console.log('wallet_tx cols', await q(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'wallet_transactions' ORDER BY ordinal_position
  `));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
