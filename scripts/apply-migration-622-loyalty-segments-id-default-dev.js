#!/usr/bin/env node
/**
 * Apply 622 on warmpawz DEV: loyalty_segments.id DEFAULT gen_random_uuid()
 *
 * RDS Data API (one statement per call).
 *
 *   node scripts/apply-migration-622-loyalty-segments-id-default-dev.js
 */
process.env.ENVIRONMENT = 'dev';

const { getClusterInfo, executeSQL } = require('./rds-data-api-utils-dev');

const ALTER_SQL =
  'ALTER TABLE loyalty_segments ALTER COLUMN id SET DEFAULT gen_random_uuid()';

const COMMENT_SQL =
  "COMMENT ON COLUMN loyalty_segments.id IS 'PK; default gen_random_uuid() if not supplied'";

(async () => {
  console.log('Migration 622: loyalty_segments.id default (dev)\n');
  await getClusterInfo();
  await executeSQL(ALTER_SQL, false);
  await executeSQL(COMMENT_SQL, false);
  console.log('\n✅ Done.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
