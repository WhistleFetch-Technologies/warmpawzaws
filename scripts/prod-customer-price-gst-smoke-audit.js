#!/usr/bin/env node
/**
 * READ-ONLY production customer price + GST smoke audit.
 * SELECT / calculation only. Does not create bookings, payments, or mutate data.
 *
 * Usage: ENVIRONMENT=prod node scripts/prod-customer-price-gst-smoke-audit.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'prod';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const PROD_API = process.env.PROD_API_BASE || 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com';
const OUT_PATH = path.join(__dirname, '..', '.tmp-prod-price-gst-audit.json');
const DEFAULT_COMMISSION = 10;
const MONEY_EPS = 1.01;

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

function money(raw) {
  const n = parseFloat(String(raw ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function near(a, b, eps = MONEY_EPS) {
  return Math.abs(money(a) - money(b)) <= eps;
}

function parseJson(raw) {
  if (raw == null) return {};
  if (typeof raw === 'object') return raw;
  try {
    const o = JSON.parse(String(raw));
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

const CITY_TO_STATE = {
  bangalore: 'karnataka',
  bengaluru: 'karnataka',
  mumbai: 'maharashtra',
  pune: 'maharashtra',
  delhi: 'delhi',
  hyderabad: 'telangana',
  chennai: 'tamil nadu',
};
const STATE_ALIASES = {
  ka: 'karnataka',
  karnataka: 'karnataka',
  mh: 'maharashtra',
  maharashtra: 'maharashtra',
  dl: 'delhi',
  delhi: 'delhi',
  tg: 'telangana',
  telangana: 'telangana',
  tn: 'tamil nadu',
  'tamil nadu': 'tamil nadu',
};

function stateKey(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (!s) return '';
  if (STATE_ALIASES[s]) return STATE_ALIASES[s];
  if (CITY_TO_STATE[s]) return CITY_TO_STATE[s];
  return s;
}

function pickRate(row) {
  const t = money(row.tax_rate);
  const d = row.default_gst_rate == null ? undefined : money(row.default_gst_rate);
  const g = row.gst_rate == null ? undefined : money(row.gst_rate);
  if (t !== 0) return t;
  if (t === 0 && d != null && d > 0) return d;
  if (t === 0 && g != null && g > 0) return g;
  if (d != null) return d;
  if (g != null) return g;
  return t;
}

function gstSplit(taxable, rate, isInter) {
  const gst = round2((money(taxable) * money(rate)) / 100);
  if (gst <= 0.009) return { gst: 0, cgst: 0, sgst: 0, igst: 0 };
  if (isInter) return { gst, cgst: 0, sgst: 0, igst: gst };
  const cgst = round2(gst / 2);
  return { gst, cgst, sgst: round2(gst - cgst), igst: 0 };
}

function isPackageMeta(meta) {
  const m = parseJson(meta);
  const details = parseJson(m.packageDetails);
  return Boolean(
    m.isPackage ||
      String(m.type || '') === 'package' ||
      String(m.packageType || '') === 'session' ||
      (details && typeof details === 'object' && (details.totalSessions || details.sessions))
  );
}

function packageSessions(meta) {
  const m = parseJson(meta);
  const details = parseJson(m.packageDetails);
  const n = Number(details.totalSessions || details.sessions || m.totalSessions || 0);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const VET_ROLES = new Set([
  'vet_clinic',
  'veterinarian',
  'vet_solo',
  'vet',
  'veterinary_clinic',
  'solo_vet',
  'pet_clinic',
]);

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
  if (ENVIRONMENT !== 'prod' && process.env.ALLOW_NON_PROD !== '1') {
    console.log(`Refusing to run unless ENVIRONMENT=prod (got ${ENVIRONMENT}). Set ALLOW_NON_PROD=1 to override.`);
    process.exit(1);
  }

  console.log(`READ-ONLY ${ENVIRONMENT} customer price + GST audit via RDS Data API`);
  const meta = await getClusterMeta();
  const client = new RDSDataClient({ region: REGION });

  async function q(sql) {
    const res = await client.send(
      new ExecuteStatementCommand({
        resourceArn: meta.resourceArn,
        secretArn: meta.secretArn,
        database: meta.database,
        sql,
        includeResultMetadata: true,
      })
    );
    return rowsFromResult(res);
  }

  async function qAll(sqlWithoutLimit, pageSize = 400) {
    const all = [];
    let offset = 0;
    for (;;) {
      const rows = await q(`${sqlWithoutLimit} LIMIT ${pageSize} OFFSET ${offset}`);
      all.push(...rows);
      process.stdout.write(`  fetched ${all.length}\r`);
      if (rows.length < pageSize) break;
      offset += pageSize;
    }
    process.stdout.write('\n');
    return all;
  }

  const coverage = (await q(`
    SELECT
      (SELECT COUNT(*)::int FROM vendors v
        WHERE COALESCE(v.is_active, true) = true
          AND (
            LOWER(TRIM(COALESCE(v.status::text, ''))) IN ('approved', 'active', 'activated')
            OR (LOWER(TRIM(COALESCE(v.status::text, ''))) = 'pending'
                AND LOWER(TRIM(COALESCE(v.vendor_type::text, ''))) = 'solo')
          )
      ) AS active_vendors,
      (SELECT COUNT(*)::int FROM vendor_services vs
        JOIN vendors v ON v.id = vs.vendor_id
        WHERE vs.is_enabled = true
          AND COALESCE(v.is_active, true) = true
          AND (
            vs.publish_status IS NULL
            OR LOWER(TRIM(COALESCE(vs.publish_status::text, ''))) IN ('published', 'auto_published', 'draft')
          )
      ) AS active_services,
      (SELECT COUNT(*)::int FROM meal_plans mp
        JOIN vendors v ON v.id = mp.vendor_id
        WHERE COALESCE(mp.is_active, true) = true
          AND COALESCE(v.is_active, true) = true
      ) AS active_meal_plans
  `))[0];

  console.log('Coverage counts:', coverage);

  const roles = await q(`SELECT id::text AS id, name, display_name FROM roles`);
  const roleById = new Map(roles.map((r) => [String(r.id), r]));

  const categories = await q(`
    SELECT id::text AS id, category_id, name, is_active
    FROM service_categories
  `);
  const catById = new Map(categories.map((c) => [String(c.id), c]));
  const catBySlug = new Map(
    categories.filter((c) => c.category_id).map((c) => [String(c.category_id).toLowerCase(), c])
  );
  const catByName = new Map(
    categories.filter((c) => c.name).map((c) => [String(c.name).toLowerCase().trim(), c])
  );

  function resolveCatalog(ref) {
    if (!ref) return null;
    const s = String(ref).trim();
    if (catById.has(s)) return catById.get(s);
    const low = s.toLowerCase();
    return catBySlug.get(low) || catByName.get(low) || null;
  }

  const taxRows = await q(`
    SELECT tc.id::text AS id, tc.category_name, tc.tax_rate,
           tc.gst_application_scope, tc.catalog_category_id::text AS catalog_category_id,
           tc.is_active,
           (SELECT COUNT(*)::int FROM tax_category_roles tcr WHERE tcr.tax_category_id = tc.id) AS jcnt
    FROM tax_categories tc
    WHERE COALESCE(tc.is_active, true) = true
  `);

  const taxConfigSummary = await q(`
    SELECT
      COUNT(*)::int AS active_tax_rows,
      SUM(CASE WHEN catalog_category_id IS NOT NULL THEN 1 ELSE 0 END)::int AS with_catalog,
      SUM(CASE WHEN catalog_category_id IS NULL THEN 1 ELSE 0 END)::int AS without_catalog,
      SUM(CASE WHEN COALESCE(gst_application_scope, 'service_booking') = 'service_booking' THEN 1 ELSE 0 END)::int AS service_scope,
      SUM(CASE WHEN gst_application_scope = 'meal_plan_food' THEN 1 ELSE 0 END)::int AS meal_food_scope,
      SUM(CASE WHEN gst_application_scope = 'meal_plan_delivery' THEN 1 ELSE 0 END)::int AS meal_delivery_scope
    FROM tax_categories
    WHERE COALESCE(is_active, true) = true
  `);

  const taxRoles = await q(`
    SELECT tax_category_id::text AS tax_category_id, role_id::text AS role_id
    FROM tax_category_roles
  `).catch(() => []);
  const rolesByTax = new Map();
  for (const tr of taxRoles) {
    const list = rolesByTax.get(tr.tax_category_id) || [];
    list.push(tr.role_id);
    rolesByTax.set(tr.tax_category_id, list);
  }

  function resolveGst(catalogUuid, roleId, scope) {
    const want =
      scope === 'meal_plan_food' || scope === 'meal_plan_delivery' ? scope : 'service_booking';
    const list = taxRows.filter((tc) => {
      if (!tc.catalog_category_id || String(tc.catalog_category_id) !== String(catalogUuid)) return false;
      const sc = String(tc.gst_application_scope || 'service_booking');
      return sc === want;
    });
    if (!list.length) {
      return { found: false, rate: 0, taxCategoryId: null, reason: 'no_admin_tax_category' };
    }
    const candidates = [];
    for (const tc of list) {
      const linked = rolesByTax.get(tc.id) || [];
      if (linked.length === 0) candidates.push({ tc, score: 1 });
      else if (roleId && linked.includes(String(roleId))) candidates.push({ tc, score: 2 });
    }
    if (!candidates.length) {
      return { found: false, rate: 0, taxCategoryId: null, reason: 'role_not_mapped' };
    }
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0].tc;
    const rate = pickRate(best);
    if (rate == null) {
      return { found: false, rate: 0, taxCategoryId: best.id, reason: 'rate_not_configured' };
    }
    return { found: true, rate, taxCategoryId: best.id, reason: candidates[0].score === 2 ? 'role_match' : 'wildcard' };
  }

  console.log('Loading vendors…');
  const vendors = await qAll(`
    SELECT v.id::text AS vendor_id,
           v.business_name,
           v.status,
           v.is_active,
           v.is_online,
           v.vendor_type,
           v.state,
           v.city,
           v.tier,
           v.role_id::text AS role_id,
           r.name AS role_name,
           r.display_name AS role_display,
           COALESCE(
             (SELECT vt.commission_rate
              FROM vendor_tier_subscriptions vts
              JOIN vendor_tiers vt ON vt.id = vts.tier_id
              WHERE vts.vendor_id = v.id
                AND vts.status = 'active'
                AND (vts.end_date IS NULL OR vts.end_date > NOW())
              ORDER BY vts.created_at DESC
              LIMIT 1),
             (SELECT vt.commission_rate
              FROM vendor_tiers vt
              WHERE vt.is_active = true
                AND TRIM(LOWER(v.tier)) = TRIM(LOWER(vt.tier_name))
              LIMIT 1),
             (SELECT vt.commission_rate
              FROM vendor_tiers vt
              WHERE vt.is_active = true
                AND (vt.is_default = true OR LOWER(TRIM(vt.tier_name)) = 'bronze')
              ORDER BY vt.is_default DESC, vt.tier_level ASC NULLS LAST
              LIMIT 1),
             ${DEFAULT_COMMISSION}
           ) AS commission_rate
    FROM vendors v
    LEFT JOIN roles r ON r.id = v.role_id
    WHERE COALESCE(v.is_active, true) = true
      AND (
        LOWER(TRIM(COALESCE(v.status::text, ''))) IN ('approved', 'active', 'activated')
        OR (
          LOWER(TRIM(COALESCE(v.status::text, ''))) = 'pending'
          AND LOWER(TRIM(COALESCE(v.vendor_type::text, ''))) = 'solo'
        )
      )
    ORDER BY v.id
  `);
  const vendorById = new Map(vendors.map((v) => [v.vendor_id, v]));
  console.log(`Vendors: ${vendors.length}`);

  console.log('Loading services…');
  const services = await qAll(`
    SELECT vs.id::text AS vendor_service_id,
           vs.vendor_id::text AS vendor_id,
           COALESCE(vs.service_name, sc.service_name, vs.service_id::text) AS service_name,
           vs.service_style,
           vs.category AS vs_category,
           vs.category_id::text AS vs_category_id,
           vs.price,
           vs.custom_price,
           vs.updated_at AS vs_updated_at,
           vs.is_enabled,
           vs.publish_status,
           vs.metadata::text AS vs_metadata,
           sc.base_price AS admin_default_price,
           sc.service_id AS catalog_service_id,
           sc.category_id AS sc_category_id,
           sc.category_name AS sc_category_name,
           sc.sub_category_id,
           sc.sub_category_name,
           sc.metadata::text AS sc_metadata
    FROM vendor_services vs
    JOIN vendors v ON v.id = vs.vendor_id
    LEFT JOIN service_catalog sc ON sc.id = vs.service_id
    WHERE vs.is_enabled = true
      AND COALESCE(vs.is_deleted, false) = false
      AND COALESCE(v.is_active, true) = true
      AND (
        LOWER(TRIM(COALESCE(v.status::text, ''))) IN ('approved', 'active', 'activated')
        OR (
          LOWER(TRIM(COALESCE(v.status::text, ''))) = 'pending'
          AND LOWER(TRIM(COALESCE(v.vendor_type::text, ''))) = 'solo'
        )
      )
      AND (
        vs.publish_status IS NULL
        OR LOWER(TRIM(COALESCE(vs.publish_status::text, ''))) IN ('published', 'auto_published', 'draft')
      )
    ORDER BY vs.id
  `);
  console.log(`Services: ${services.length}`);

  console.log('Loading meal plans (including inactive — customer-facing requires is_active)…');
  const meals = await qAll(`
    SELECT mp.id::text AS meal_plan_id,
           mp.vendor_id::text AS vendor_id,
           COALESCE(mp.plan_name, mp.name) AS plan_name,
           mp.price_per_meal,
           mp.price_per_week,
           mp.meal_type,
           mp.is_active,
           mp.service_catalog_category_id::text AS service_catalog_category_id,
           mp.tax_category_id::text AS tax_category_id,
           mp.dietary_requirements::text AS dietary_requirements
    FROM meal_plans mp
    LEFT JOIN vendors v ON v.id = mp.vendor_id
    ORDER BY mp.id
  `);
  console.log(`Meal plans: ${meals.length}`);

  console.log('Loading historical booking/payment aggregates (180d)…');
  const bookingAgg = await qAll(`
    SELECT b.service_id::text AS vendor_service_id,
           COUNT(*)::int AS booking_count,
           ROUND(AVG(b.base_price)::numeric, 2) AS avg_base_price,
           ROUND(MIN(b.base_price)::numeric, 2) AS min_base_price,
           ROUND(MAX(b.base_price)::numeric, 2) AS max_base_price,
           ROUND(AVG(b.tax_amount)::numeric, 2) AS avg_tax_amount,
           ROUND(AVG(b.total_amount)::numeric, 2) AS avg_total_amount,
           ROUND(AVG(b.discount_amount)::numeric, 2) AS avg_discount
    FROM bookings b
    WHERE b.created_at > NOW() - INTERVAL '180 days'
      AND b.service_id IS NOT NULL
      AND COALESCE(b.is_package_session, false) = false
    GROUP BY b.service_id
    ORDER BY b.service_id
  `);
  const bookingByVs = new Map(bookingAgg.map((r) => [r.vendor_service_id, r]));

  const paymentAgg = await qAll(`
    SELECT b.service_id::text AS vendor_service_id,
           COUNT(*)::int AS payment_count,
           ROUND(AVG(p.amount)::numeric, 2) AS avg_paid,
           ROUND(AVG(p.gst_amount)::numeric, 2) AS avg_gst,
           ROUND(AVG(p.cgst_amount)::numeric, 2) AS avg_cgst,
           ROUND(AVG(p.sgst_amount)::numeric, 2) AS avg_sgst,
           ROUND(AVG(p.igst_amount)::numeric, 2) AS avg_igst,
           SUM(CASE WHEN COALESCE(p.igst_amount,0) > 0 AND (COALESCE(p.cgst_amount,0) > 0 OR COALESCE(p.sgst_amount,0) > 0) THEN 1 ELSE 0 END)::int AS mixed_regime_count
    FROM payments p
    JOIN bookings b ON b.id = p.booking_id
    WHERE p.created_at > NOW() - INTERVAL '180 days'
      AND b.service_id IS NOT NULL
      AND COALESCE(b.is_package_session, false) = false
    GROUP BY b.service_id
    ORDER BY b.service_id
  `);
  const payByVs = new Map(paymentAgg.map((r) => [r.vendor_service_id, r]));

  const packagePay = await q(`
    SELECT COUNT(*)::int AS purchase_count,
           ROUND(AVG(pp.package_price)::numeric, 2) AS avg_package_price,
           ROUND(AVG(pp.tax_amount)::numeric, 2) AS avg_tax,
           ROUND(AVG(pp.total_with_tax)::numeric, 2) AS avg_total_with_tax,
           ROUND(AVG(pp.tax_rate)::numeric, 2) AS avg_tax_rate,
           ROUND(AVG(pp.amount)::numeric, 2) AS avg_amount
    FROM package_purchases pp
    WHERE pp.created_at > NOW() - INTERVAL '180 days'
  `).catch(() => [{ purchase_count: 0 }]);

  const paymentLeakage = await q(`
    SELECT COUNT(*)::int AS paid_rows,
           SUM(CASE
             WHEN COALESCE(p.platform_commission,0) > 1
              AND ABS(COALESCE(p.amount,0) - COALESCE(p.gst_amount,0) - COALESCE(p.vendor_amount,0)) <= 1.01
              AND ABS(COALESCE(p.amount,0) - COALESCE(p.gst_amount,0) - (COALESCE(p.vendor_amount,0) + COALESCE(p.platform_commission,0))) > 1.01
             THEN 1 ELSE 0 END)::int AS taxable_equals_vendor_net,
           SUM(CASE
             WHEN COALESCE(p.platform_commission,0) > 1
              AND ABS(COALESCE(p.amount,0) - COALESCE(p.vendor_amount,0)) <= 1.01
             THEN 1 ELSE 0 END)::int AS paid_equals_vendor_net,
           ROUND(AVG(p.amount)::numeric, 2) AS avg_paid,
           ROUND(AVG(p.gst_amount)::numeric, 2) AS avg_gst,
           ROUND(AVG(p.platform_commission)::numeric, 2) AS avg_commission,
           ROUND(AVG(p.vendor_amount)::numeric, 2) AS avg_vendor_amount
    FROM payments p
    WHERE p.created_at > NOW() - INTERVAL '180 days'
      AND COALESCE(p.payment_status, '') IN ('paid', 'captured', 'success', 'completed', 'authorized')
      AND p.booking_id IS NOT NULL
  `);

  const mealOrderAgg = await q(`
    SELECT COUNT(*)::int AS order_count,
           ROUND(AVG(mo.subtotal)::numeric, 2) AS avg_subtotal,
           ROUND(AVG(mo.tax_amount)::numeric, 2) AS avg_tax,
           ROUND(AVG(mo.total_amount)::numeric, 2) AS avg_total,
           ROUND(AVG(mo.delivery_fee)::numeric, 2) AS avg_delivery
    FROM meal_orders mo
    WHERE mo.created_at > NOW() - INTERVAL '180 days'
  `).catch(() => [{ order_count: 0 }]);

  const recentMixed = await q(`
    SELECT COUNT(*)::int AS mixed
    FROM payments p
    WHERE p.created_at > NOW() - INTERVAL '180 days'
      AND COALESCE(p.igst_amount,0) > 0
      AND (COALESCE(p.cgst_amount,0) > 0 OR COALESCE(p.sgst_amount,0) > 0)
  `);

  const recentPkgGst = await q(`
    SELECT pp.id::text AS purchase_id,
           pp.vendor_id::text AS vendor_id,
           pp.package_name,
           pp.package_price, pp.tax_rate, pp.tax_amount, pp.total_with_tax, pp.amount,
           pp.total_sessions,
           (SELECT COUNT(*)::int FROM bookings b WHERE b.package_purchase_id = pp.id) AS session_bookings,
           (SELECT ROUND(AVG(b.tax_amount)::numeric, 2) FROM bookings b
             WHERE b.package_purchase_id = pp.id AND COALESCE(b.is_package_session, false) = true) AS avg_session_tax,
           (SELECT ROUND(AVG(b.base_price)::numeric, 2) FROM bookings b
             WHERE b.package_purchase_id = pp.id AND COALESCE(b.is_package_session, false) = true) AS avg_session_base
    FROM package_purchases pp
    WHERE pp.created_at > NOW() - INTERVAL '180 days'
    ORDER BY pp.created_at DESC
    LIMIT 80
  `).catch(() => []);

  const rows = [];
  const leakage = [];
  const gstIssues = [];
  const discrepancies = [];
  let pass = 0;
  let warn = 0;
  let fail = 0;
  let notTested = 0;

  function catalogForService(s, vendor) {
    const vsMeta = parseJson(s.vs_metadata);
    const scMeta = parseJson(s.sc_metadata);
    const explicit =
      vsMeta.gst_catalog_category_id ||
      vsMeta.gst_catalog_category_ref ||
      scMeta.gst_catalog_category_id ||
      scMeta.gst_catalog_category_ref;
    const ref =
      explicit ||
      s.sc_category_id ||
      s.vs_category_id ||
      (s.vs_category && String(s.vs_category).toLowerCase() !== 'pet_services' ? s.vs_category : null) ||
      s.sc_category_name ||
      (VET_ROLES.has(String(vendor.role_name || '').toLowerCase()) ? 'veterinary' : null);
    return resolveCatalog(ref);
  }

  function priceInclusive(s) {
    const vsMeta = parseJson(s.vs_metadata);
    const scMeta = parseJson(s.sc_metadata);
    return Boolean(vsMeta.show_final_price_inclusive_tax || scMeta.show_final_price_inclusive_tax);
  }

  for (const s of services) {
    const vendor = vendorById.get(s.vendor_id);
    if (!vendor) {
      notTested += 1;
      continue;
    }
    // Authority: vendor configured selling price. Admin catalogue is default/reference only.
    const adminDefault = s.admin_default_price == null ? null : money(s.admin_default_price);
    const listed = money(s.custom_price != null ? s.custom_price : s.price);
    const commRate = money(vendor.commission_rate);
    const commissionAmt = round2((listed * commRate) / 100);
    const vendorNet = round2(listed - commissionAmt);
    const cat = catalogForService(s, vendor);
    const gstRes = cat
      ? resolveGst(cat.id, vendor.role_id, 'service_booking')
      : { found: false, rate: 0, taxCategoryId: null, reason: 'no_catalog_category' };
    const inclusive = priceInclusive(s);
    const taxable = inclusive && gstRes.rate > 0 ? round2(listed / (1 + gstRes.rate / 100)) : listed;
    const vendorState = stateKey(vendor.state) || stateKey(vendor.city);
    const intra = gstSplit(taxable, gstRes.rate, false);
    const inter = gstSplit(taxable, gstRes.rate, true);
    const hist = bookingByVs.get(s.vendor_service_id);
    const pay = payByVs.get(s.vendor_service_id);
    const pkg = isPackageMeta(s.vs_metadata) || isPackageMeta(s.sc_metadata);
    const sessions = packageSessions(s.vs_metadata) || packageSessions(s.sc_metadata);

    let customerDiscount = hist ? money(hist.avg_discount) : 0;
    let checkoutPrice = hist ? money(hist.avg_base_price) : listed;
    let discountSource = hist && customerDiscount > 0.5 ? 'historical_booking_discount' : 'none';

    const flags = [];
    let status = 'PASS';

    if (listed <= 0) {
      flags.push('zero_or_missing_list_price');
      status = 'WARN';
    }
    if (!gstRes.found) {
      flags.push(`gst_config_${gstRes.reason}`);
      status = status === 'FAIL' ? 'FAIL' : 'WARN';
    }

    if (hist && listed > 1) {
      const histBase = money(hist.avg_base_price);
      // Leakage only vs vendor configured selling price — never vs Admin default.
      if (near(histBase, vendorNet) && !near(histBase, listed) && commissionAmt > 1) {
        flags.push('CRITICAL_COMMISSION_LEAKAGE');
        status = 'FAIL';
        leakage.push({
          vendor: vendor.business_name,
          vendorId: vendor.vendor_id,
          item: s.service_name,
          itemType: pkg ? 'package' : 'service',
          adminDefault,
          vendorConfigured: listed,
          commission: commissionAmt,
          vendorNet,
          customerDisplay: listed,
          customerCheckout: histBase,
          taxable: histBase,
          difference: round2(listed - histBase),
          rootCause:
            'booking.base_price ≈ vendor_configured_selling_price − platform_commission (Admin default not used)',
          severity: 'CRITICAL',
        });
      } else if (!near(histBase, listed) && customerDiscount < 0.5) {
        const unexplained = round2(listed - histBase);
        if (Math.abs(unexplained) > 1) {
          flags.push('vendor_configured_vs_historical_booking_delta');
          if (status !== 'FAIL') status = 'WARN';
          discrepancies.push({
            kind: 'vendor_configured_vs_booking',
            vendor: vendor.business_name,
            item: s.service_name,
            adminDefault,
            vendorConfigured: listed,
            bookingAvg: histBase,
            delta: unexplained,
            commissionAmt,
          });
        }
      }
    }

    if (pay) {
      const impliedTaxableFromGst =
        gstRes.rate > 0 && money(pay.avg_gst) > 0 ? round2((money(pay.avg_gst) * 100) / gstRes.rate) : null;
      if (
        impliedTaxableFromGst != null &&
        near(impliedTaxableFromGst, vendorNet) &&
        !near(impliedTaxableFromGst, listed) &&
        commissionAmt > 1
      ) {
        flags.push('CRITICAL_COMMISSION_LEAKAGE_INTO_TAXABLE');
        status = 'FAIL';
      }
      if (gstRes.found && gstRes.rate > 0 && money(pay.avg_gst) > 0) {
        const expectedGstOnListed = gstSplit(listed, gstRes.rate, false).gst;
        const expectedGstOnNet = gstSplit(vendorNet, gstRes.rate, false).gst;
        if (near(pay.avg_gst, expectedGstOnNet) && !near(pay.avg_gst, expectedGstOnListed)) {
          flags.push('gst_matches_vendor_net_not_customer_base');
          status = 'FAIL';
        }
      }
      if (money(pay.mixed_regime_count) > 0) {
        flags.push('mixed_cgst_sgst_igst');
        status = 'FAIL';
      }
    }

    if (status === 'PASS') pass += 1;
    else if (status === 'WARN') warn += 1;
    else fail += 1;

    rows.push({
      vendor: vendor.business_name,
      vendorId: vendor.vendor_id,
      role: vendor.role_name || vendor.role_display || '',
      category: cat ? cat.category_id || cat.name : s.sc_category_id || s.vs_category || '',
      itemType: pkg ? 'package' : 'service',
      item: s.service_name,
      itemId: s.vendor_service_id,
      adminDefaultPrice: adminDefault,
      listedPrice: listed,
      vendorConfiguredPrice: listed,
      customerPrice: listed,
      customerDiscount,
      discountSource,
      taxableAmount: taxable,
      gstRate: gstRes.found ? gstRes.rate : null,
      gstFound: gstRes.found,
      gstReason: gstRes.reason,
      gst: intra.gst,
      cgst: intra.cgst,
      sgst: intra.sgst,
      igstIntra: intra.igst,
      igstInter: inter.igst,
      customerFees: 0,
      finalCustomerPayableIntra: round2(taxable + intra.gst),
      finalCustomerPayableInter: round2(taxable + inter.igst),
      platformCommission: commissionAmt,
      commissionRate: commRate,
      vendorEarning: vendorNet,
      vendorState,
      inclusive,
      sessions,
      histBookingCount: hist ? hist.booking_count : 0,
      histCheckoutBase: hist ? money(hist.avg_base_price) : null,
      histGst: pay ? money(pay.avg_gst) : null,
      histPaid: pay ? money(pay.avg_paid) : null,
      flags,
      status,
    });
  }

  for (const m of meals) {
    const vendor = vendorById.get(m.vendor_id);
    if (!vendor) {
      notTested += 1;
      continue;
    }
    if (!m.is_active) {
      notTested += 1;
      rows.push({
        vendor: vendor.business_name,
        vendorId: vendor.vendor_id,
        role: vendor.role_name || '',
        category: 'nutritionist',
        itemType: 'meal_plan',
        item: m.plan_name,
        itemId: m.meal_plan_id,
        listedPrice: money(m.price_per_meal),
        status: 'NOT TESTED',
        flags: ['meal_plan_inactive_not_customer_facing'],
      });
      continue;
    }
    const listed = money(m.price_per_meal != null ? m.price_per_meal : m.price_per_week);
    const commRate = money(vendor.commission_rate);
    const commissionAmt = round2((listed * commRate) / 100);
    const vendorNet = round2(listed - commissionAmt);
    const diet = parseJson(m.dietary_requirements);
    const cat =
      resolveCatalog(m.service_catalog_category_id) ||
      resolveCatalog(diet.catalogCategoryId || diet.catalog_category_id || diet.catalog_category_ref) ||
      resolveCatalog('nutritionist');
    const foodGst = cat
      ? resolveGst(cat.id, vendor.role_id, 'meal_plan_food')
      : { found: false, rate: 0, reason: 'no_catalog_category' };
    const delGst = cat
      ? resolveGst(cat.id, vendor.role_id, 'meal_plan_delivery')
      : { found: false, rate: 0, reason: 'no_catalog_category' };
    const food = gstSplit(listed, foodGst.rate, false);
    let status = 'PASS';
    const flags = [];
    if (listed <= 0) {
      flags.push('zero_or_missing_meal_price');
      status = 'WARN';
    }
    if (!foodGst.found) {
      flags.push(`meal_food_gst_${foodGst.reason}`);
      status = status === 'FAIL' ? 'FAIL' : 'WARN';
    }
    if (!delGst.found) {
      flags.push(`meal_delivery_gst_${delGst.reason}`);
      if (status !== 'FAIL') status = 'WARN';
    }
    if (status === 'PASS') pass += 1;
    else if (status === 'WARN') warn += 1;
    else fail += 1;

    rows.push({
      vendor: vendor.business_name,
      vendorId: vendor.vendor_id,
      role: vendor.role_name || '',
      category: cat ? cat.category_id || cat.name : 'nutritionist',
      itemType: 'meal_plan',
      item: m.plan_name,
      itemId: m.meal_plan_id,
      listedPrice: listed,
      customerPrice: listed,
      customerDiscount: 0,
      discountSource: 'none',
      taxableAmount: listed,
      gstRate: foodGst.found ? foodGst.rate : null,
      gstFound: foodGst.found,
      gstReason: foodGst.reason,
      gst: food.gst,
      cgst: food.cgst,
      sgst: food.sgst,
      igstIntra: food.igst,
      deliveryGstRate: delGst.found ? delGst.rate : null,
      customerFees: 0,
      finalCustomerPayableIntra: round2(listed + food.gst),
      platformCommission: commissionAmt,
      commissionRate: commRate,
      vendorEarning: vendorNet,
      flags,
      status,
    });
  }

  const pkgRows = rows.filter((r) => r.itemType === 'package');
  const svcRows = rows.filter((r) => r.itemType === 'service');
  const mealRows = rows.filter((r) => r.itemType === 'meal_plan');

  const roleCoverage = {};
  for (const v of vendors) {
    const key = v.role_name || 'unknown';
    if (!roleCoverage[key]) roleCoverage[key] = { vendors: 0, services: 0, packages: 0, meals: 0 };
    roleCoverage[key].vendors += 1;
  }
  for (const r of rows) {
    const key = r.role || 'unknown';
    if (!roleCoverage[key]) roleCoverage[key] = { vendors: 0, services: 0, packages: 0, meals: 0 };
    if (r.itemType === 'service') roleCoverage[key].services += 1;
    if (r.itemType === 'package') roleCoverage[key].packages += 1;
    if (r.itemType === 'meal_plan') roleCoverage[key].meals += 1;
  }

  const categoryCoverage = {};
  for (const r of rows) {
    const key = r.category || 'unknown';
    categoryCoverage[key] = (categoryCoverage[key] || 0) + 1;
  }

  const gstMissing = rows.filter((r) => r.gstFound === false);
  const failRows = rows.filter((r) => r.status === 'FAIL');
  const warnRows = rows.filter((r) => r.status === 'WARN');

  const representatives = [];
  const seenCat = new Set();
  for (const r of rows) {
    const key = `${r.role}|${r.category}|${r.itemType}`;
    if (seenCat.has(key)) continue;
    if (r.listedPrice <= 0) continue;
    seenCat.add(key);
    representatives.push(r);
  }

  console.log('Probing production /tax/calculate for representative items (no bookings)…');
  const apiProbes = [];
  const probeLimit = Math.min(representatives.length, 24);
  for (let i = 0; i < probeLimit; i += 1) {
    const r = representatives[i];
    if (r.itemType === 'meal_plan') continue;
    const vendor = vendorById.get(r.vendorId);
    const vendorState = vendor ? vendor.state || vendor.city || 'Karnataka' : 'Karnataka';
    const sameState = vendorState;
    const otherState = stateKey(vendorState) === 'karnataka' ? 'Maharashtra' : 'Karnataka';
    for (const [label, customerState] of [
      ['intra', sameState],
      ['inter', otherState],
    ]) {
      try {
        const body = {
          items: [
            {
              id: r.itemId,
              type: 'service',
              amount: r.listedPrice,
              quantity: 1,
              serviceId: r.itemId,
            },
          ],
          vendorId: r.vendorId,
          vendorLocation: { state: vendorState },
          customerLocation: { state: customerState },
        };
        const res = await fetch(`${PROD_API}/tax/calculate`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        apiProbes.push({
          item: r.item,
          vendor: r.vendor,
          scenario: label,
          http: res.status,
          taxable: json.subtotal ?? json.taxableAmount ?? null,
          gst: json.totalTax ?? json.gstAmount ?? null,
          cgst: json.cgst ?? json.cgstAmount ?? json.breakdown?.cgst ?? null,
          sgst: json.sgst ?? json.sgstAmount ?? json.breakdown?.sgst ?? null,
          igst: json.igst ?? json.igstAmount ?? json.breakdown?.igst ?? null,
          grandTotal: json.grandTotal ?? json.total ?? null,
          error: json.error || json.message || null,
        });
      } catch (e) {
        apiProbes.push({
          item: r.item,
          vendor: r.vendor,
          scenario: label,
          error: String(e.message || e),
        });
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    environment: ENVIRONMENT,
    note:
      'Read-only. Authoritative customer base = vendor_services.custom_price else price. Admin service_catalog.base_price is default/reference only and is never used as a customer-price mismatch. Leakage = checkout base ≈ vendor_configured − commission. New GST lineage code is on feature/bindushree-gst-financial-lineage and is NOT assumed deployed to prod Lambda.',
    coverage: {
      vendors: vendors.length,
      services: svcRows.length,
      packages: pkgRows.length,
      meals: mealRows.length,
      dbCounts: coverage,
      roles: roleCoverage,
      categories: categoryCoverage,
    },
    totals: { pass, warn, fail, notTested },
    taxConfigSummary: taxConfigSummary[0] || {},
    taxCategories: taxRows.map((t) => ({
      name: t.category_name,
      rate: money(t.tax_rate),
      catalog: t.catalog_category_id,
      scope: t.gst_application_scope || 'service_booking',
      roleLinks: t.jcnt,
    })),
    paymentLeakage180d: paymentLeakage[0] || {},
    packagePurchases180d: packagePay[0] || {},
    mealOrders180d: mealOrderAgg[0] || {},
    mixedRegimePayments180d: recentMixed[0] || {},
    recentPackageGstVsSessions: recentPkgGst,
    leakage,
    gstMissingCount: gstMissing.length,
    gstMissingSample: gstMissing.slice(0, 80),
    failRows,
    warnSample: warnRows.slice(0, 80),
    discrepancies,
    representatives,
    apiProbes,
    rows,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));
  console.log(`Wrote ${OUT_PATH}`);
  console.log(
    JSON.stringify(
      {
        vendors: vendors.length,
        services: svcRows.length,
        packages: pkgRows.length,
        meals: mealRows.length,
        pass,
        warn,
        fail,
        notTested,
        leakage: leakage.length,
        gstMissing: gstMissing.length,
        apiProbes: apiProbes.length,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
