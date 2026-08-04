#!/usr/bin/env node
/**
 * Set (or reset) a vendor portal password on AWS RDS (via RDS Data API).
 *
 * Usage:
 *   ENVIRONMENT=dev node scripts/set-vendor-password.js <phone-last-10-or-full> <new-password>
 *
 * Example:
 *   ENVIRONMENT=dev node scripts/set-vendor-password.js 8780459376 'raju@1234'
 */

const path = require('path');
const bcrypt = require('bcryptjs');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { getClusterInfo, query, DATABASE_NAME } = require('./rds-data-api-utils-dev');

const BCRYPT_ROUNDS = 10;

async function executeParameterized(sql, parameters) {
  const clusterInfo = await getClusterInfo();
  const client = new RDSDataClient({ region: process.env.AWS_REGION || 'ap-south-1' });
  return client.send(
    new ExecuteStatementCommand({
      resourceArn: clusterInfo.clusterArn,
      secretArn: clusterInfo.secretArn,
      database: DATABASE_NAME,
      sql,
      parameters,
      includeResultMetadata: true,
    })
  );
}

function parseReturnRow(result) {
  if (!result.records?.length || !result.columnMetadata?.length) return null;
  const names = result.columnMetadata.map((c) => c.name);
  const values = result.records[0].map((f) => {
    if (f.isNull) return null;
    if (f.stringValue !== undefined) return f.stringValue;
    if (f.booleanValue !== undefined) return f.booleanValue;
    return null;
  });
  const row = {};
  names.forEach((n, i) => {
    row[n] = values[i];
  });
  return row;
}

async function main() {
  const phoneArg = process.argv[2];
  const newPassword = process.argv[3];

  if (!phoneArg || !newPassword) {
    console.error('Usage: ENVIRONMENT=dev node scripts/set-vendor-password.js <phone> <password>');
    process.exit(1);
  }

  const last10 = String(phoneArg).replace(/\D/g, '').slice(-10);
  if (last10.length < 10) {
    console.error('Phone must contain at least 10 digits.');
    process.exit(1);
  }

  const rows = await query(
    `SELECT id, phone, business_name, status, is_active, is_deleted,
            CASE WHEN password_hash IS NOT NULL AND length(trim(password_hash)) > 0 THEN true ELSE false END AS has_password
     FROM vendors
     WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = '${last10}'
     ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST`
  );

  if (rows.length === 0) {
    console.error(`No vendor found for phone ending in ${last10}`);
    process.exit(1);
  }

  const active = rows.filter((r) => !(r.is_deleted === true || r.is_deleted === 't' || r.is_deleted === 1));
  const target = active[0] || rows[0];

  if (!active.length) {
    console.warn('Warning: all matching vendor rows are soft-deleted; updating the most recent row anyway.');
  }

  if (rows.length > 1) {
    console.log(`Found ${rows.length} vendor rows for this phone; updating primary active row:`);
    rows.forEach((r) => {
      console.log(`  - ${r.id} | ${r.business_name || '(no name)'} | active=${r.is_active} | deleted=${r.is_deleted}`);
    });
  }

  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const vendorId = String(target.id);

  let updated;
  try {
    updated = await executeParameterized(
      `UPDATE vendors
       SET password_hash = :hash,
           auth_version = COALESCE(auth_version, 0) + 1,
           updated_at = NOW()
       WHERE id = :vendor_id::uuid
       RETURNING id, phone, business_name`,
      [
        { name: 'hash', value: { stringValue: hash } },
        { name: 'vendor_id', value: { stringValue: vendorId } },
      ]
    );
  } catch (e) {
    if (String(e.message || '').includes('auth_version')) {
      updated = await executeParameterized(
        `UPDATE vendors
         SET password_hash = :hash, updated_at = NOW()
         WHERE id = :vendor_id::uuid
         RETURNING id, phone, business_name`,
        [
          { name: 'hash', value: { stringValue: hash } },
          { name: 'vendor_id', value: { stringValue: vendorId } },
        ]
      );
    } else {
      throw e;
    }
  }

  const row = parseReturnRow(updated);
  console.log('Vendor password updated successfully.');
  console.log(`  Environment: ${process.env.ENVIRONMENT || 'dev'}`);
  console.log(`  Vendor ID:   ${row?.id || vendorId}`);
  console.log(`  Phone:       ${row?.phone || target.phone}`);
  console.log(`  Business:    ${row?.business_name || target.business_name || '(none)'}`);
  console.log(`  Had password before: ${target.has_password ? 'yes' : 'no'}`);
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
