#!/usr/bin/env node
/**
 * Read-only prod query via RDS Data API (works outside VPC).
 * Usage: ENVIRONMENT=prod node scripts/query-prod-vet-gst-services.js
 */
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'prod';
const REGION = process.env.AWS_REGION || 'ap-south-1';

function cellValue(field) {
  if (field == null) return null;
  if (field.isNull) return null;
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.longValue !== undefined) return field.longValue;
  if (field.doubleValue !== undefined) return field.doubleValue;
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.blobValue !== undefined) return '[blob]';
  return null;
}

function rowsFromResult(result) {
  const cols = (result.columnMetadata || []).map((c) => c.name);
  return (result.records || []).map((rec) => {
    const row = {};
    rec.forEach((field, i) => {
      row[cols[i] || `col_${i}`] = cellValue(field);
    });
    return row;
  });
}

async function getClusterMeta() {
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const clusterInfo = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  );
  const cluster = clusterInfo.DBClusters[0];
  if (!cluster.HttpEndpointEnabled) {
    throw new Error('RDS Data API not enabled on cluster');
  }
  const secretName =
    ENVIRONMENT === 'prod'
      ? 'warmpawz-prod-rds-master-20260207201049162400000001'
      : `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  const sm = new SecretsManagerClient({ region: REGION });
  const secretValue = await sm.send(new GetSecretValueCommand({ SecretId: secretName }));
  return {
    resourceArn: cluster.DBClusterArn,
    database: cluster.DatabaseName || 'warmpawz',
    secretArn: secretValue.ARN,
  };
}

async function main() {
  const meta = await getClusterMeta();
  const client = new RDSDataClient({ region: REGION });

  async function q(label, sql) {
    console.log(`\n=== ${label} ===`);
    const res = await client.send(
      new ExecuteStatementCommand({
        resourceArn: meta.resourceArn,
        secretArn: meta.secretArn,
        database: meta.database,
        sql,
        includeResultMetadata: true,
      })
    );
    const rows = rowsFromResult(res);
    console.log(`rows: ${rows.length}`);
    console.log(JSON.stringify(rows, null, 2));
    return rows;
  }

  console.log(`Environment: ${ENVIRONMENT} (RDS Data API)`);

  await q('1) SERVICE CATALOG: vet home visit, deworming, home-service samples', `
    SELECT sc.service_id, sc.service_name, sc.category_id, sc.category_name, sc.service_style,
           sc.tax_category_id::text, sc.hsn_code_id::text,
           sc.metadata->>'show_final_price_inclusive_tax' AS price_inclusive_tax,
           sc.status
    FROM service_catalog sc
    WHERE sc.service_id IN ('vet_home_visit', 'vet_deworming', 'groom_home', 'train_home', 'diag_home_sample')
       OR (sc.category_id = 'veterinary' AND (sc.service_name ILIKE '%deworm%' OR sc.service_name ILIKE '%home visit%'))
    ORDER BY sc.service_id
  `);

  await q('2) CATALOG MASTER CATEGORY: veterinary', `
    SELECT id::text, category_id, name, is_active FROM service_categories
    WHERE category_id = 'veterinary' OR LOWER(name) LIKE '%veterinar%'
    ORDER BY category_id NULLS LAST, name
  `);

  await q('3) ADMIN GST CONFIG (service_booking) for veterinary', `
    SELECT tc.id::text, tc.category_name, tc.tax_rate,
           COALESCE(tc.gst_application_scope, 'service_booking') AS scope,
           sc.category_id AS catalog_slug, sc.name AS catalog_name,
           (SELECT COUNT(*)::int FROM tax_category_roles tcr WHERE tcr.tax_category_id = tc.id) AS role_link_count
    FROM tax_categories tc
    LEFT JOIN service_categories sc ON sc.id = tc.catalog_category_id
    WHERE tc.is_active = true
      AND COALESCE(tc.gst_application_scope, 'service_booking') = 'service_booking'
      AND (
        sc.category_id = 'veterinary'
        OR tc.category_name ILIKE '%veterinar%'
        OR tc.catalog_category_id IN (SELECT id FROM service_categories WHERE category_id = 'veterinary')
      )
    ORDER BY tc.category_name, tc.tax_rate
  `);

  await q('3b) GST role links for veterinary tax_categories', `
    SELECT tc.category_name, tc.tax_rate, r.name AS role_name, r.id::text AS role_id
    FROM tax_categories tc
    JOIN tax_category_roles tcr ON tcr.tax_category_id = tc.id
    JOIN roles r ON r.id = tcr.role_id
    JOIN service_categories sc ON sc.id = tc.catalog_category_id
    WHERE tc.is_active = true
      AND sc.category_id = 'veterinary'
      AND COALESCE(tc.gst_application_scope, 'service_booking') = 'service_booking'
    ORDER BY tc.tax_rate, r.name
  `);

  await q('4) Home Visit Consultation — published vendor count by role', `
    SELECT r.name AS role_name, COUNT(*)::int AS cnt
    FROM vendor_services vs
    JOIN vendors v ON v.id = vs.vendor_id
    JOIN roles r ON r.id = v.role_id
    LEFT JOIN service_catalog sc ON sc.id = vs.service_id
    WHERE vs.is_enabled = true
      AND (sc.service_id = 'vet_home_visit' OR vs.service_name ILIKE '%home visit%consult%')
      AND COALESCE(vs.publish_status, 'published') IN ('published', 'auto_published')
    GROUP BY r.name ORDER BY cnt DESC
  `);

  await q('5) Deworming — published counts by service_style and role', `
    SELECT vs.service_style, r.name AS role_name, COUNT(*)::int AS cnt
    FROM vendor_services vs
    JOIN vendors v ON v.id = vs.vendor_id
    JOIN roles r ON r.id = v.role_id
    LEFT JOIN service_catalog sc ON sc.id = vs.service_id
    WHERE vs.is_enabled = true
      AND (sc.service_id = 'vet_deworming' OR vs.service_name ILIKE '%deworm%')
      AND COALESCE(vs.publish_status, 'published') IN ('published', 'auto_published')
    GROUP BY vs.service_style, r.name
    ORDER BY vs.service_style, r.name
  `);

  await q('6) Deworming at_home sample vendors (price + tax-inclusive flags)', `
    SELECT v.business_name, r.name AS role_name, vs.service_style, sc.service_id,
           vs.price, vs.custom_price,
           vs.metadata->>'show_final_price_inclusive_tax' AS vs_inclusive,
           sc.metadata->>'show_final_price_inclusive_tax' AS sc_inclusive
    FROM vendor_services vs
    JOIN vendors v ON v.id = vs.vendor_id
    JOIN roles r ON r.id = v.role_id
    LEFT JOIN service_catalog sc ON sc.id = vs.service_id
    WHERE vs.is_enabled = true
      AND (sc.service_id = 'vet_deworming' OR vs.service_name ILIKE '%deworm%')
      AND vs.service_style = 'at_home'
      AND COALESCE(vs.publish_status, 'published') IN ('published', 'auto_published')
    ORDER BY r.name, v.business_name
    LIMIT 20
  `);

  await q('7) Grooming home-service (groom_home) GST config', `
    SELECT tc.category_name, tc.tax_rate, sc.category_id AS catalog_slug
    FROM tax_categories tc
    LEFT JOIN service_categories sc ON sc.id = tc.catalog_category_id
    WHERE tc.is_active = true
      AND COALESCE(tc.gst_application_scope, 'service_booking') = 'service_booking'
      AND sc.category_id = 'grooming'
  `);

  await q('8) Recent bookings (90d) — vet home visit & deworming GST', `
    SELECT v.business_name, r.name AS role_name, b.service_style,
           sc.service_id, vs.service_name,
           b.base_price, b.tax_amount, b.total_amount,
           CASE WHEN COALESCE(b.base_price,0) > 0 AND COALESCE(b.tax_amount,0) > 0
                THEN ROUND((b.tax_amount / b.base_price * 100)::numeric, 2) ELSE 0 END AS implied_gst_pct,
           b.created_at::date AS booked_on
    FROM bookings b
    JOIN vendors v ON v.id = b.vendor_id
    JOIN roles r ON r.id = v.role_id
    LEFT JOIN vendor_services vs ON vs.id = b.service_id
    LEFT JOIN service_catalog sc ON sc.id = vs.service_id
    WHERE (sc.service_id IN ('vet_home_visit', 'vet_deworming')
           OR vs.service_name ILIKE '%deworm%'
           OR vs.service_name ILIKE '%home visit%')
      AND b.created_at > NOW() - INTERVAL '90 days'
    ORDER BY b.created_at DESC
    LIMIT 25
  `);

  await q('9) Recent payments (90d) — gst_amount on vet home/deworm', `
    SELECT sc.service_id, vs.service_name, r.name AS role_name,
           p.amount, p.gst_amount, p.cgst_amount, p.sgst_amount, p.igst_amount,
           p.created_at::date AS paid_on
    FROM payments p
    JOIN bookings b ON b.id = p.booking_id
    JOIN vendors v ON v.id = b.vendor_id
    JOIN roles r ON r.id = v.role_id
    LEFT JOIN vendor_services vs ON vs.id = b.service_id
    LEFT JOIN service_catalog sc ON sc.id = vs.service_id
    WHERE (sc.service_id IN ('vet_home_visit', 'vet_deworming')
           OR vs.service_name ILIKE '%deworm%'
           OR vs.service_name ILIKE '%home visit%')
      AND p.created_at > NOW() - INTERVAL '90 days'
    ORDER BY p.created_at DESC
    LIMIT 25
  `);

  await q('10) ALL active tax_categories (service_booking)', `
    SELECT tc.category_name, tc.tax_rate, sc.category_id AS catalog_slug,
           (SELECT string_agg(r.name, ', ' ORDER BY r.name)
            FROM tax_category_roles tcr JOIN roles r ON r.id = tcr.role_id
            WHERE tcr.tax_category_id = tc.id) AS linked_roles
    FROM tax_categories tc
    LEFT JOIN service_categories sc ON sc.id = tc.catalog_category_id
    WHERE tc.is_active = true
      AND COALESCE(tc.gst_application_scope, 'service_booking') = 'service_booking'
    ORDER BY sc.category_id, tc.tax_rate
  `);

  await q('11) Vet home/deworm payments: gst>0 vs gst=0 by role (90d)', `
    SELECT r.name AS role_name,
           SUM(CASE WHEN COALESCE(p.gst_amount,0) > 0 THEN 1 ELSE 0 END)::int AS with_gst,
           SUM(CASE WHEN COALESCE(p.gst_amount,0) = 0 THEN 1 ELSE 0 END)::int AS without_gst
    FROM payments p
    JOIN bookings b ON b.id = p.booking_id
    JOIN vendors v ON v.id = b.vendor_id
    JOIN roles r ON r.id = v.role_id
    LEFT JOIN vendor_services vs ON vs.id = b.service_id
    LEFT JOIN service_catalog sc ON sc.id = vs.service_id
    WHERE (sc.service_id IN ('vet_home_visit', 'vet_deworming')
           OR vs.service_name ILIKE '%deworm%'
           OR vs.service_name ILIKE '%home visit%')
      AND p.created_at > NOW() - INTERVAL '90 days'
    GROUP BY r.name
    ORDER BY r.name
  `);

  await q('12) Vaccination catalog + GST tax rows', `
    SELECT service_id, category_id, sub_category_id, sub_category_name,
           metadata->>'show_final_price_inclusive_tax' AS price_inclusive
    FROM service_catalog
    WHERE service_id = 'vet_vaccination' OR service_name ILIKE '%vaccination%'
    LIMIT 10
  `);

  await q('13) tax_categories with vaccin in name', `
    SELECT category_name, tax_rate, sc.category_id AS catalog_slug,
           (SELECT string_agg(r.name, ', ') FROM tax_category_roles tcr JOIN roles r ON r.id = tcr.role_id WHERE tcr.tax_category_id = tc.id) AS roles
    FROM tax_categories tc
    LEFT JOIN service_categories sc ON sc.id = tc.catalog_category_id
    WHERE tc.is_active = true AND tc.category_name ILIKE '%vaccin%'
  `);

  await q('14) Recent vaccination payments GST (90d)', `
    SELECT sc.service_id, vs.service_name, r.name AS role_name, p.amount, p.gst_amount, p.created_at::date
    FROM payments p
    JOIN bookings b ON b.id = p.booking_id
    JOIN vendors v ON v.id = b.vendor_id
    JOIN roles r ON r.id = v.role_id
    LEFT JOIN vendor_services vs ON vs.id = b.service_id
    LEFT JOIN service_catalog sc ON sc.id = vs.service_id
    WHERE (sc.service_id = 'vet_vaccination' OR vs.service_name ILIKE '%vaccin%')
      AND p.created_at > NOW() - INTERVAL '90 days'
    ORDER BY p.created_at DESC
    LIMIT 15
  `);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
