#!/usr/bin/env node
/** Apply migration 620 on warmpawz DEV (019 legacy column defaults). */
process.env.ENVIRONMENT = 'dev';

const { getClusterInfo, executeSQL } = require('./rds-data-api-utils-dev');

const STMTS = [
  `ALTER TABLE insurance_plans ALTER COLUMN provider SET DEFAULT 'Vendor';`,
  `ALTER TABLE insurance_plans ALTER COLUMN plan_type SET DEFAULT 'lifetime';`,
  `ALTER TABLE insurance_plans ALTER COLUMN coverage SET DEFAULT '{}'::jsonb;`,
  `ALTER TABLE insurance_plans ALTER COLUMN monthly_premium SET DEFAULT 0;`,
  `ALTER TABLE insurance_plans ALTER COLUMN annual_premium SET DEFAULT 0;`,
];

(async () => {
  console.log('Migration 620: insurance_plans 019 defaults (dev)\n');
  await getClusterInfo();
  for (let i = 0; i < STMTS.length; i++) {
    console.log(`--- ${i + 1}/${STMTS.length}`);
    await executeSQL(STMTS[i], false);
  }
  console.log('\n✅ Done.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
