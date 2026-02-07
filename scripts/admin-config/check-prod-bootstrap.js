#!/usr/bin/env node
/**
 * Check if prod one-time bootstrap has already been run.
 * Exit 0 if bootstrap done, 1 if not (so pipeline can skip seed/import).
 * Usage: DATABASE_URL=... node scripts/admin-config/check-prod-bootstrap.js
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.env.TARGET_DATABASE_URL;
if (!DATABASE_URL) {
  console.error('TARGET_DATABASE_URL or DATABASE_URL required');
  process.exit(1);
}

async function check() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('rds.') ? { rejectUnauthorized: false } : undefined,
  });
  try {
    const r = await pool.query(
      `SELECT 1 FROM platform_settings WHERE setting_key = 'prod_bootstrap_completed' LIMIT 1`
    );
    const done = r.rows.length > 0;
    if (done) {
      console.log('prod_bootstrap_completed found – bootstrap already done');
      process.exit(0);
    }
    console.log('prod_bootstrap_completed not set – bootstrap not done');
    process.exit(1);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

check();
