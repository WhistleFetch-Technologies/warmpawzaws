/**
 * Prod RDS: align loyalty_rules + loyalty_transactions with dev (Data API, one statement each).
 *   node apply-prod-loyalty-dev-parity.js
 */
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const REGION = 'ap-south-1';

function prodTarget() {
  const c = JSON.parse(
    execSync(
      'aws rds describe-db-clusters --db-cluster-identifier warmpawz-prod-cluster --region ' +
        REGION +
        ' --output json',
      { encoding: 'utf8' }
    )
  ).DBClusters[0];
  const s = JSON.parse(
    execSync(
      'aws secretsmanager describe-secret --secret-id warmpawz-prod-rds-master-20260207201049162400000001 --region ' +
        REGION +
        ' --output json',
      { encoding: 'utf8' }
    )
  );
  return { resourceArn: c.DBClusterArn, secretArn: s.ARN, database: 'warmpawz' };
}

const STATEMENTS = [
  // 043 parity: columns dev has
  `ALTER TABLE loyalty_rules ADD COLUMN IF NOT EXISTS auto_convert_to_wallet BOOLEAN DEFAULT true`,
  `ALTER TABLE loyalty_rules ADD COLUMN IF NOT EXISTS conversion_rate NUMERIC(5, 2) DEFAULT 1.0`,
  // Match dev "Standard" wallet math: 100 points = ₹1
  `UPDATE loyalty_rules SET redemption_rate = 100, auto_convert_to_wallet = true, updated_at = NOW() WHERE is_active = true`,
  // 625: vendor referral earns
  `ALTER TABLE loyalty_transactions ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL`,
  `ALTER TABLE loyalty_transactions ALTER COLUMN customer_id DROP NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_vendor_id ON loyalty_transactions (vendor_id) WHERE vendor_id IS NOT NULL`,
];

async function main() {
  const t = prodTarget();
  const client = new RDSDataClient({ region: REGION });
  let i = 0;
  for (const sql of STATEMENTS) {
    i += 1;
    console.log(`[${i}/${STATEMENTS.length}]`, sql.slice(0, 72) + (sql.length > 72 ? '...' : ''));
    await client.send(new ExecuteStatementCommand({ ...t, sql }));
  }

  const verify = await client.send(
    new ExecuteStatementCommand({
      ...t,
      sql: `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'loyalty_transactions' AND column_name = 'vendor_id'`,
      formatRecordsAs: 'JSON',
    })
  );
  const lr = await client.send(
    new ExecuteStatementCommand({
      ...t,
      sql: `SELECT rule_name, is_active, auto_convert_to_wallet, redemption_rate FROM loyalty_rules WHERE is_active = true`,
      formatRecordsAs: 'JSON',
    })
  );
  const nullcust = await client.send(
    new ExecuteStatementCommand({
      ...t,
      sql: `SELECT is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'loyalty_transactions' AND column_name = 'customer_id'`,
      formatRecordsAs: 'JSON',
    })
  );
  console.log('\nVerify vendor_id column:', verify.formattedRecords || '[]');
  console.log('Verify active loyalty_rules:', lr.formattedRecords || '[]');
  console.log('Verify customer_id nullable:', nullcust.formattedRecords || '[]');
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
