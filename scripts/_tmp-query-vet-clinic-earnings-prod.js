/**
 * Prod RDS: Vet Clinic earnings breakdown (~90K investigation)
 * Usage: node scripts/_tmp-query-vet-clinic-earnings-prod.js
 */
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');

const REGION = 'ap-south-1';
const CLUSTER_ID = 'warmpawz-prod-cluster';
const SECRET_NAME = 'warmpawz-prod-rds-master-20260207201049162400000001';

function target() {
  const c = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${CLUSTER_ID} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  ).DBClusters[0];
  const s = JSON.parse(
    execSync(`aws secretsmanager describe-secret --secret-id ${SECRET_NAME} --region ${REGION} --output json`, {
      encoding: 'utf8',
    })
  );
  return { resourceArn: c.DBClusterArn, secretArn: s.ARN, database: 'warmpawz' };
}

async function q(client, t, sql) {
  const r = await client.send(
    new ExecuteStatementCommand({ ...t, sql, formatRecordsAs: 'JSON' })
  );
  return r.formattedRecords ? JSON.parse(r.formattedRecords) : [];
}

async function main() {
  const client = new RDSDataClient({ region: REGION });
  const t = target();

  console.log('=== PROD: Find Vet Clinic vendor(s) ===\n');
  const vendors = await q(
    client,
    t,
    `SELECT id::text, phone, business_name, owner_name, address, tier,
            commission_percentage::text,
            created_at::text
     FROM vendors
     WHERE business_name ILIKE '%vet%clinic%'
        OR (address ILIKE '%48%church%street%' AND business_name ILIKE '%vet%')
     ORDER BY
       CASE WHEN business_name ILIKE 'vet clinic' THEN 0
            WHEN address ILIKE '%48 church street%' THEN 1
            ELSE 2 END,
       business_name
     LIMIT 30`
  );
  console.log(JSON.stringify(vendors, null, 2));
  if (!vendors.length) {
    console.log('No vendor found.');
    return;
  }

  const targetVendor =
    vendors.find((v) => /^vet clinic$/i.test((v.business_name || '').trim())) ||
    vendors.find((v) => /48 church street/i.test(v.address || '') && /vet/i.test(v.business_name || '')) ||
    vendors[0];
  const vendorIds = [
    ...new Set(
      vendors
        .filter(
          (v) =>
            /^vet clinic$/i.test((v.business_name || '').trim()) ||
            ((v.address || '').toLowerCase().includes('48 church street') &&
              (v.business_name || '').toLowerCase().includes('vet'))
        )
        .map((v) => v.id)
    ),
  ];
  if (!vendorIds.length) vendorIds.push(targetVendor.id);

  for (const vid of vendorIds) {
    const vrow = vendors.find((x) => x.id === vid) || targetVendor;
    console.log('\n' + '='.repeat(72));
    console.log('VENDOR:', vrow.business_name, '|', vid, '|', vrow.address);
    console.log('='.repeat(72));
    await reportVendor(client, t, vid);
  }
}

async function reportVendor(client, t, vid) {

  console.log('\n=== vendor_earnings summary (all time) ===');
  const sumAll = await q(
    client,
    t,
    `SELECT COUNT(*)::int AS row_count,
            ROUND(COALESCE(SUM(amount),0)::numeric, 2)::text AS sum_vendor_amount,
            ROUND(COALESCE(SUM(commission_amount),0)::numeric, 2)::text AS sum_commission,
            ROUND(COALESCE(SUM(total_amount),0)::numeric, 2)::text AS sum_gross,
            MIN(realized_at)::text AS first_realized,
            MAX(realized_at)::text AS last_realized
     FROM vendor_earnings
     WHERE vendor_id = '${vid}'::uuid`
  );
  console.log(JSON.stringify(sumAll, null, 2));

  const identity = await q(
    client,
    t,
    `SELECT vi.id::text AS identity_id, vi.phone, vi.onboarding_status,
            v.id::text AS linked_vendor_id
     FROM vendor_identity vi
     LEFT JOIN vendors v ON v.phone = vi.phone
     WHERE vi.phone = (SELECT phone FROM vendors WHERE id = '${vid}'::uuid LIMIT 1)
        OR v.id = '${vid}'::uuid
        OR vi.id = '${vid}'::uuid`
  );
  console.log('Identity / phone link:', JSON.stringify(identity, null, 2));

  console.log('\n=== By status ===');
  const byStatus = await q(
    client,
    t,
    `SELECT status, COUNT(*)::int AS cnt,
            ROUND(SUM(amount)::numeric, 2)::text AS sum_amount
     FROM vendor_earnings
     WHERE vendor_id = '${vid}'::uuid
     GROUP BY status
     ORDER BY SUM(amount) DESC`
  );
  console.log(JSON.stringify(byStatus, null, 2));

  console.log('\n=== By month (IST, realized_at) ===');
  const byMonth = await q(
    client,
    t,
    `SELECT to_char(timezone('Asia/Kolkata', realized_at), 'YYYY-MM') AS month_ist,
            COUNT(*)::int AS cnt,
            ROUND(SUM(amount)::numeric, 2)::text AS sum_amount
     FROM vendor_earnings
     WHERE vendor_id = '${vid}'::uuid
     GROUP BY 1
     ORDER BY 1 DESC
     LIMIT 24`
  );
  console.log(JSON.stringify(byMonth, null, 2));

  console.log('\n=== Today / this week / this month (IST) — matches UI periods ===');
  const periods = await q(
    client,
    t,
    `SELECT
       ROUND(COALESCE(SUM(amount) FILTER (
         WHERE realized_at >= (timezone('Asia/Kolkata', now()))::date::timestamp AT TIME ZONE 'Asia/Kolkata'
           AND realized_at < ((timezone('Asia/Kolkata', now()))::date + interval '1 day')::timestamp AT TIME ZONE 'Asia/Kolkata'
       ), 0)::numeric, 2)::text AS today_ist,
       ROUND(COALESCE(SUM(amount) FILTER (
         WHERE realized_at >= ((timezone('Asia/Kolkata', now()))::date - interval '6 days')::timestamp AT TIME ZONE 'Asia/Kolkata'
       ), 0)::numeric, 2)::text AS week_ist,
       ROUND(COALESCE(SUM(amount) FILTER (
         WHERE realized_at >= date_trunc('month', timezone('Asia/Kolkata', now())) AT TIME ZONE 'Asia/Kolkata'
       ), 0)::numeric, 2)::text AS month_ist,
       ROUND(COALESCE(SUM(amount), 0)::numeric, 2)::text AS lifetime
     FROM vendor_earnings
     WHERE vendor_id = '${vid}'::uuid`
  );
  console.log(JSON.stringify(periods, null, 2));

  console.log('\n=== Top 15 largest earnings rows ===');
  const top = await q(
    client,
    t,
    `SELECT ve.id::text, ve.amount::text, ve.commission_amount::text, ve.total_amount::text,
            ve.commission_rate::text, ve.status,
            ve.realized_at::text, ve.booking_id::text,
            b.booking_date::text, b.status AS booking_status,
            COALESCE(sc.service_name, s.name, 'unknown') AS service_name
     FROM vendor_earnings ve
     LEFT JOIN bookings b ON b.id = ve.booking_id
     LEFT JOIN service_catalog sc ON b.service_id = sc.id
     LEFT JOIN services s ON b.service_id = s.id
     WHERE ve.vendor_id = '${vid}'::uuid
     ORDER BY ve.amount DESC NULLS LAST
     LIMIT 15`
  );
  console.log(JSON.stringify(top, null, 2));

  console.log('\n=== Duplicate booking_id in vendor_earnings? ===');
  const dupes = await q(
    client,
    t,
    `SELECT booking_id::text, COUNT(*)::int AS cnt, ROUND(SUM(amount)::numeric,2)::text AS sum_amt
     FROM vendor_earnings
     WHERE vendor_id = '${vid}'::uuid AND booking_id IS NOT NULL
     GROUP BY booking_id
     HAVING COUNT(*) > 1
     ORDER BY COUNT(*) DESC
     LIMIT 10`
  );
  console.log(dupes.length ? JSON.stringify(dupes, null, 2) : 'No duplicate booking_id rows.');

  console.log('\n=== Center siblings (same center_id) — could inflate ledger? ===');
  const siblings = await q(
    client,
    t,
    `SELECT v2.id::text, v2.business_name, v2.owner_name,
            (SELECT COUNT(*)::int FROM vendor_earnings ve WHERE ve.vendor_id = v2.id) AS earn_rows,
            (SELECT ROUND(COALESCE(SUM(amount),0)::numeric,2)::text FROM vendor_earnings ve WHERE ve.vendor_id = v2.id) AS earn_sum
     FROM vendors v1
     JOIN vendors v2 ON v2.center_id = v1.center_id AND v1.center_id IS NOT NULL
     WHERE v1.id = '${vid}'::uuid`
  );
  console.log(siblings.length ? JSON.stringify(siblings, null, 2) : 'No center siblings or no center_id.');

  console.log('\n=== vendors table payout columns (if exist) ===');
  try {
    const vcols = await q(
      client,
      t,
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='vendors'
         AND column_name IN ('pending_payout','total_earnings','total_revenue')`
    );
    console.log('Columns:', vcols.map((c) => c.column_name).join(', ') || 'none');
    if (vcols.length) {
      const vp = await q(
        client,
        t,
        `SELECT pending_payout::text, total_earnings::text FROM vendors WHERE id = '${vid}'::uuid`
      );
      console.log('Vendor row:', JSON.stringify(vp, null, 2));
    }
  } catch (e) {
    console.log('(payout columns query skipped:', e.message, ')');
  }

  console.log('\n=== All vendor_ids with same phone (earnings per id) ===');
  const samePhone = await q(
    client,
    t,
    `SELECT v.id::text, v.business_name,
            COUNT(ve.id)::int AS rows,
            ROUND(COALESCE(SUM(ve.amount),0)::numeric,2)::text AS sum_amt
     FROM vendors v
     LEFT JOIN vendor_earnings ve ON ve.vendor_id = v.id
     WHERE v.phone = (SELECT phone FROM vendors WHERE id = '${vid}'::uuid)
     GROUP BY v.id, v.business_name`
  );
  console.log(JSON.stringify(samePhone, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
