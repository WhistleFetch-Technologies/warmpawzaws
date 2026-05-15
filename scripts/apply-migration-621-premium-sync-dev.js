#!/usr/bin/env node
/** Apply migration 621 on warmpawz DEV — sync premium_monthly ↔ monthly_premium */
process.env.ENVIRONMENT = 'dev';

const { getClusterInfo, executeSQL } = require('./rds-data-api-utils-dev');

const STMTS = [
  `UPDATE insurance_plans
SET premium_monthly = monthly_premium
WHERE (premium_monthly IS NULL OR premium_monthly = 0)
  AND monthly_premium IS NOT NULL
  AND monthly_premium > 0;`,
  `UPDATE insurance_plans
SET monthly_premium = premium_monthly
WHERE (monthly_premium IS NULL OR monthly_premium = 0)
  AND premium_monthly IS NOT NULL
  AND premium_monthly > 0;`,
];

(async () => {
  console.log('Migration 621: sync insurance_plans premium columns (dev)\n');
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
