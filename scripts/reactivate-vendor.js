#!/usr/bin/env node
/** Reactivate a soft-deleted vendor (mirrors admin POST /admin/vendors/:id/reactivate). */
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { getClusterInfo, query, DATABASE_NAME } = require('./rds-data-api-utils-dev');

const vendorId = process.argv[2];
if (!vendorId) {
  console.error('Usage: ENVIRONMENT=dev node scripts/reactivate-vendor.js <vendor-uuid>');
  process.exit(1);
}

async function execute(sql, parameters) {
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

(async () => {
  const before = await query(
    `SELECT id, phone, business_name, status, is_active, is_deleted FROM vendors WHERE id = '${vendorId}'::uuid`
  );
  if (!before.length) {
    console.error('Vendor not found:', vendorId);
    process.exit(1);
  }
  console.log('Before:', before[0]);

  await execute(
    `UPDATE vendors
     SET is_active = true,
         is_deleted = false,
         status = 'approved',
         updated_at = NOW()
     WHERE id = :vendor_id::uuid`,
    [{ name: 'vendor_id', value: { stringValue: vendorId } }]
  );

  const phone = String(before[0].phone || '').trim();
  await execute(
    `UPDATE vendor_identity
     SET is_deleted = false, updated_at = NOW()
     WHERE vendor_id = :vendor_id::uuid
        OR (:phone <> '' AND phone = :phone)`,
    [
      { name: 'vendor_id', value: { stringValue: vendorId } },
      { name: 'phone', value: { stringValue: phone } },
    ]
  );

  const after = await query(
    `SELECT v.id, v.phone, v.business_name, v.status, v.is_active, v.is_deleted,
            vi.onboarding_status, vi.is_deleted AS vi_is_deleted
     FROM vendors v
     LEFT JOIN vendor_identity vi ON vi.vendor_id = v.id OR vi.phone = v.phone
     WHERE v.id = '${vendorId}'::uuid
     LIMIT 1`
  );
  console.log('After:', after[0]);
  console.log('Vendor reactivated.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
