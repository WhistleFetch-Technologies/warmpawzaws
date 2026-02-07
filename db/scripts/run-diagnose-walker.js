#!/usr/bin/env node
/**
 * Run walker discovery diagnostic queries.
 * Usage: DATABASE_URL=postgresql://user:pass@host:5432/db node db/scripts/run-diagnose-walker.js
 */
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!DATABASE_URL) {
  console.error('Set DATABASE_URL (or SUPABASE_DB_URL) to run the diagnostic.');
  process.exit(1);
}

const QUERIES = [
  {
    title: '1) All vendors with walker-related role + service counts',
    sql: `
SELECT v.id AS vendor_id, v.business_name, v.phone, v.status, v.is_active, v.role_id,
  r.name AS role_name, r.display_name AS role_display_name,
  (SELECT COUNT(*) FROM vendor_services vs WHERE vs.vendor_id = v.id AND vs.is_enabled = true) AS enabled_services_count,
  (SELECT COUNT(*) FROM vendor_services vs WHERE vs.vendor_id = v.id AND vs.is_enabled = true AND (vs.service_style = 'at_home' OR vs.service_style IS NULL)) AS at_home_count
FROM vendors v
LEFT JOIN roles r ON v.role_id = r.id
WHERE r.name IS NOT NULL AND (LOWER(r.name) IN ('walker','walker_solo','pet_walker','dog_walker') OR LOWER(REPLACE(r.name, ' ', '_')) IN ('walker','walker_solo','pet_walker','dog_walker'))
ORDER BY v.business_name`,
  },
  {
    title: '2) Discovery check (OK or first failing reason)',
    sql: `
SELECT v.id, v.business_name, v.status, v.is_active, r.name AS role_name,
  CASE
    WHEN v.status NOT IN ('approved', 'active') THEN 'FAIL: status not approved/active'
    WHEN v.is_active IS NOT TRUE THEN 'FAIL: is_active not true'
    WHEN NOT EXISTS (SELECT 1 FROM vendor_services vs WHERE vs.vendor_id = v.id AND vs.is_enabled = true) THEN 'FAIL: no enabled vendor_services'
    WHEN COALESCE(LOWER(v.business_name), '') LIKE '%clinic%' THEN 'FAIL: business_name contains clinic'
    WHEN COALESCE(LOWER(v.business_name), '') LIKE '%center%' OR COALESCE(LOWER(v.business_name), '') LIKE '%centre%' THEN 'FAIL: business_name contains center/centre'
    ELSE 'OK'
  END AS discovery_check
FROM vendors v
LEFT JOIN roles r ON v.role_id = r.id
WHERE r.name IS NOT NULL AND (LOWER(r.name) IN ('walker','walker_solo','pet_walker','dog_walker') OR LOWER(REPLACE(r.name, ' ', '_')) IN ('walker','walker_solo','pet_walker','dog_walker'))
ORDER BY v.business_name`,
  },
  {
    title: "3) Roles containing 'walk'",
    sql: "SELECT id, name, display_name, is_active FROM roles WHERE LOWER(name) LIKE '%walk%' OR LOWER(display_name) LIKE '%walk%'",
  },
  {
    title: '4) Vendors with NULL role_id (walker-like name)',
    sql: "SELECT id, business_name, phone, status, is_active, role_id FROM vendors WHERE role_id IS NULL AND (business_name ILIKE '%walker%' OR business_name ILIKE '%walk%')",
  },
];

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('rds.') || DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  try {
    for (const { title, sql } of QUERIES) {
      console.log('\n---', title, '---');
      const res = await client.query(sql.trim());
      if (res.rows.length) console.table(res.rows);
      else console.log('(no rows)');
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
