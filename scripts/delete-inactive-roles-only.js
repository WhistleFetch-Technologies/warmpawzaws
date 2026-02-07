#!/usr/bin/env node
/**
 * Delete INACTIVE roles only - strict.
 * - Deletes only roles where is_active = false
 * - Deletes only roles with zero vendors assigned
 * - Does NOT touch any active role (no UPDATE, no DELETE on active)
 */

const { Pool } = require('pg');
const { execSync } = require('child_process');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const SECRET_ARN = process.env.DB_SECRET_ARN || 'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-dev-rds-master-20260106164510791100000002-WqZcjI';

async function getDbCredentials() {
  if (process.env.DB_USER && process.env.DB_PASSWORD) {
    return {
      host: process.env.DB_HOST || 'warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'warmpawz',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    };
  }
  const secretValue = execSync(
    `aws secretsmanager get-secret-value --secret-id "${SECRET_ARN}" --region "${REGION}" --query SecretString --output text`,
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
  ).trim();
  const secret = JSON.parse(secretValue);
  return {
    host: secret.host,
    port: parseInt(secret.port || '5432'),
    database: secret.dbname || 'warmpawz',
    user: secret.username,
    password: secret.password,
  };
}

async function main() {
  console.log('🔒 Delete INACTIVE roles only (strict – active roles untouched)\n');

  const creds = await getDbCredentials();
  const pool = new Pool({ ...creds, ssl: creds.host && creds.host.includes('rds.amazonaws.com') ? { rejectUnauthorized: false } : false });

  try {
    // 1) List inactive roles with no references (vendors, onboarding apps, vendor_identity) - safe to delete
    const inactiveNoVendors = await pool.query(`
      SELECT r.id, r.name, r.display_name, r.is_active, r.is_system_role
      FROM roles r
      LEFT JOIN (SELECT role_id, COUNT(*) AS c FROM vendors WHERE role_id IS NOT NULL GROUP BY role_id) v ON v.role_id = r.id
      LEFT JOIN (SELECT role_id, COUNT(*) AS c FROM vendor_onboarding_applications WHERE role_id IS NOT NULL GROUP BY role_id) o ON o.role_id = r.id
      LEFT JOIN (SELECT selected_role_id AS role_id, COUNT(*) AS c FROM vendor_identity WHERE selected_role_id IS NOT NULL GROUP BY selected_role_id) vi ON vi.role_id = r.id
      WHERE r.is_active = false
        AND (v.c IS NULL OR v.c = 0)
        AND (o.c IS NULL OR o.c = 0)
        AND (vi.c IS NULL OR vi.c = 0)
      ORDER BY r.name
    `);

    if (inactiveNoVendors.rows.length === 0) {
      console.log('✅ No inactive roles with zero vendors found. Nothing to delete.');
      await pool.end();
      return;
    }

    console.log('📋 Inactive roles to DELETE (no vendors):');
    inactiveNoVendors.rows.forEach((r) => {
      console.log(`   - ${r.name} (${r.id})`);
    });
    console.log(`   Total: ${inactiveNoVendors.rows.length}\n`);

    const ids = inactiveNoVendors.rows.map((r) => r.id);

    // 2) Delete role_permissions for these roles only
    const permResult = await pool.query(
      'DELETE FROM role_permissions WHERE role_id = ANY($1::uuid[]) RETURNING role_id',
      [ids]
    );
    console.log(`🗑️  Deleted ${permResult.rowCount} role_permissions rows`);

    // 3) Delete only these inactive roles (no active roles touched)
    const deleteResult = await pool.query(
      'DELETE FROM roles WHERE id = ANY($1::uuid[]) AND is_active = false RETURNING id, name',
      [ids]
    );
    console.log(`🗑️  Deleted ${deleteResult.rowCount} inactive roles:`);
    deleteResult.rows.forEach((r) => console.log(`   - ${r.name} (${r.id})`));

    // 4) Verify: count active roles (should be unchanged)
    const activeCount = await pool.query('SELECT COUNT(*) AS c FROM roles WHERE is_active = true');
    const inactiveRemaining = await pool.query('SELECT COUNT(*) AS c FROM roles WHERE is_active = false');
    console.log('\n📊 After cleanup:');
    console.log(`   Active roles (unchanged): ${activeCount.rows[0].c}`);
    console.log(`   Inactive roles remaining: ${inactiveRemaining.rows[0].c}`);
    console.log('\n✅ Done. Only inactive roles with no vendors were deleted.');
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
