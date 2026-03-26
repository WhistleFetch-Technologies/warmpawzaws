#!/usr/bin/env node
/**
 * Apply 619 on warmpawz DEV only: DEFAULT for insurance_plans.plan_id
 */
process.env.ENVIRONMENT = 'dev';

const { getClusterInfo, executeSQL } = require('./rds-data-api-utils-dev');

const SQL =
  'ALTER TABLE insurance_plans ALTER COLUMN plan_id SET DEFAULT gen_random_uuid()::text;';

(async () => {
  console.log('Migration 619: plan_id default (dev)\n');
  await getClusterInfo();
  await executeSQL(SQL, false);
  console.log('\n✅ Done.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
