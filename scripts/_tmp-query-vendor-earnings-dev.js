const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const t = {
  resourceArn: 'arn:aws:rds:ap-south-1:057442119249:cluster:warmpawz-dev-cluster',
  secretArn:
    'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-dev-rds-master-20260106164510791100000002-WqZcjI',
  database: 'warmpawz',
};

async function q(sql) {
  const c = new RDSDataClient({ region: 'ap-south-1' });
  const r = await c.send(new ExecuteStatementCommand({ ...t, sql, formatRecordsAs: 'JSON' }));
  return r.formattedRecords ? JSON.parse(r.formattedRecords) : [];
}

async function main() {
  const vendors = await q(`
    SELECT id::text, phone, business_name, owner_name
    FROM vendors
    WHERE owner_name ILIKE '%bindushree%' OR business_name ILIKE '%bindushree%'
    LIMIT 10`);
  console.log('=== vendors ===');
  console.log(JSON.stringify(vendors, null, 2));

  const ids = vendors.map((v) => v.id).filter(Boolean);
  if (!ids.length) return;

  const inList = ids.map((id) => `'${id}'`).join(',');
  const identity = await q(`
    SELECT vi.id::text AS identity_id, vi.phone, vi.onboarding_status, v.id::text AS vendor_id
    FROM vendor_identity vi
    LEFT JOIN vendors v ON v.phone = vi.phone
    WHERE vi.phone IN (SELECT phone FROM vendors WHERE id::text IN (${inList}))
       OR vi.id::text IN (${inList})
    LIMIT 20`);
  console.log('=== identity link ===');
  console.log(JSON.stringify(identity, null, 2));

  const earn = await q(`
    SELECT vendor_id::text, COUNT(*)::int AS cnt,
           ROUND(COALESCE(SUM(amount),0)::numeric, 2)::text AS sum_amt
    FROM vendor_earnings
    WHERE vendor_id::text IN (${inList})
    GROUP BY vendor_id`);
  console.log('=== vendor_earnings by vendors.id ===');
  console.log(JSON.stringify(earn, null, 2));

  for (const id of ids) {
    const byParam = await q(`
      SELECT COUNT(*)::int AS cnt FROM vendor_earnings ve
      WHERE ve.vendor_id = '${id}'::uuid`);
    console.log(`earnings count vendor_id=${id}:`, byParam[0]?.cnt);
  }

  const vid = 'c8b26bb8-73a5-41ea-ad34-e42b195bc20c';
  const sample = await q(`
    SELECT ve.id::text, ve.amount::text, ve.status, ve.realized_at::text, ve.created_at::text,
           b.booking_date::text
    FROM vendor_earnings ve
    LEFT JOIN bookings b ON ve.booking_id = b.id
    WHERE ve.vendor_id = '${vid}'::uuid
    ORDER BY ve.realized_at DESC NULLS LAST
    LIMIT 5`);
  console.log('=== sample earnings rows ===');
  console.log(JSON.stringify(sample, null, 2));

  const joinCount = await q(`
    SELECT COUNT(*)::int AS cnt
    FROM vendor_earnings ve
    LEFT JOIN bookings b ON ve.booking_id = b.id
    LEFT JOIN service_catalog sc ON b.service_id = sc.id
    LEFT JOIN services s ON b.service_id = s.id
    LEFT JOIN vendor_services vs ON b.service_id = vs.id
    LEFT JOIN customers c ON b.customer_id = c.id
    WHERE ve.vendor_id = '${vid}'::uuid`);
  console.log('=== earnings with full joins (like API) ===', joinCount[0]?.cnt);

  const apiSql = `
    SELECT ve.*, b.booking_date, b.service_id,
           COALESCE(sc.display_name, sc.service_name, s.name, vs.service_name, b.service_name, 'Service') as service_name,
           c.full_name as customer_name
    FROM vendor_earnings ve
    LEFT JOIN bookings b ON ve.booking_id = b.id
    LEFT JOIN service_catalog sc ON b.service_id = sc.id
    LEFT JOIN services s ON b.service_id = s.id
    LEFT JOIN vendor_services vs ON b.service_id = vs.id
    LEFT JOIN customers c ON b.customer_id = c.id
    WHERE ve.vendor_id = ANY(ARRAY['${vid}']::uuid[])
    ORDER BY ve.realized_at DESC NULLS LAST
    LIMIT 3`;
  try {
    const apiRows = await q(apiSql);
    console.log('=== exact API SELECT ok, rows:', apiRows.length);
  } catch (e) {
    console.log('=== exact API SELECT FAILED ===', e.message);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
