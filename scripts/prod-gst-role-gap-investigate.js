#!/usr/bin/env node
/**
 * READ-ONLY: enumerate every customer-facing vendor service whose
 * Admin GST category + vendor-role mapping does not match.
 * Does not modify data, Admin GST, or customer-price resolvers.
 *
 * Usage (PowerShell): $env:ENVIRONMENT="prod"; node scripts/prod-gst-role-gap-investigate.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'prod';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const OUT_PATH = path.join(__dirname, '..', '.tmp-prod-gst-role-gaps.json');

const VET_ROLES = new Set([
  'vet_clinic',
  'veterinarian',
  'vet_solo',
  'vet',
  'veterinary_clinic',
  'solo_vet',
  'pet_clinic',
]);

/** Branch aliases (NOT applied to prod Lambda). Used only as a diagnostic column. */
const SLUG_ALIASES = {
  behavioral: 'training',
  behavioural: 'training',
  'lab-diagnostics': 'diagnostic',
};

function cellValue(field) {
  if (field == null || field.isNull) return null;
  return field.stringValue ?? field.longValue ?? field.doubleValue ?? field.booleanValue ?? null;
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
function isPackageMeta(meta) {
  const m = parseJson(meta);
  const details = parseJson(m.packageDetails);
  return Boolean(
    m.isPackage ||
      String(m.type || '') === 'package' ||
      String(m.packageType || '') === 'session' ||
      (details && (details.totalSessions || details.sessions))
  );
}
function packageMeta(meta) {
  const m = parseJson(meta);
  const details = parseJson(m.packageDetails);
  if (!isPackageMeta(meta)) return null;
  return {
    packageId: m.packageId || m.package_id || details.id || null,
    packageName: m.packageName || m.package_name || details.name || null,
    totalSessions: details.totalSessions || details.sessions || m.totalSessions || null,
  };
}
function truthy(v) {
  return v === true || v === 'true' || v === 1 || v === '1';
}

async function main() {
  if (ENVIRONMENT !== 'prod' && process.env.ALLOW_NON_PROD !== '1') {
    console.log('Set ENVIRONMENT=prod');
    process.exit(1);
  }
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const clusterInfo = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    )
  );
  const cluster = clusterInfo.DBClusters[0];
  const sm = new SecretsManagerClient({ region: REGION });
  const secretValue = await sm.send(
    new GetSecretValueCommand({
      SecretId:
        ENVIRONMENT === 'prod'
          ? 'warmpawz-prod-rds-master-20260207201049162400000001'
          : `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`,
    })
  );
  const client = new RDSDataClient({ region: REGION });
  async function q(sql) {
    const res = await client.send(
      new ExecuteStatementCommand({
        resourceArn: cluster.DBClusterArn,
        secretArn: secretValue.ARN,
        database: cluster.DatabaseName || 'warmpawz',
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
      if (rows.length < pageSize) break;
      offset += pageSize;
    }
    return all;
  }

  const catCols = (
    await q(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'service_categories'
      ORDER BY ordinal_position
    `)
  ).map((r) => r.column_name);
  const parentCol = ['parent_id', 'parent_category_id', 'parent_category'].find((c) =>
    catCols.includes(c)
  );
  const categories = await q(`
    SELECT id::text AS id, category_id, name, is_active
           ${parentCol ? `, ${parentCol}::text AS parent_id` : `, NULL::text AS parent_id`}
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
           tc.is_active
    FROM tax_categories tc
    WHERE COALESCE(tc.is_active, true) = true
  `);
  const taxRoles = await q(`
    SELECT tcr.tax_category_id::text AS tax_category_id,
           tcr.role_id::text AS role_id,
           r.name AS role_name
    FROM tax_category_roles tcr
    LEFT JOIN roles r ON r.id = tcr.role_id
  `).catch(() => []);
  const rolesByTax = new Map();
  const roleNamesByTax = new Map();
  for (const tr of taxRoles) {
    const ids = rolesByTax.get(tr.tax_category_id) || [];
    ids.push(tr.role_id);
    rolesByTax.set(tr.tax_category_id, ids);
    const names = roleNamesByTax.get(tr.tax_category_id) || [];
    if (tr.role_name) names.push(tr.role_name);
    roleNamesByTax.set(tr.tax_category_id, names);
  }

  function taxRowsForCatalog(catalogUuid, scope) {
    const want =
      scope === 'meal_plan_food' || scope === 'meal_plan_delivery' ? scope : 'service_booking';
    return taxRows.filter((tc) => {
      if (!tc.catalog_category_id || String(tc.catalog_category_id) !== String(catalogUuid)) {
        return false;
      }
      return String(tc.gst_application_scope || 'service_booking') === want;
    });
  }

  function resolveGst(catalogUuid, roleId) {
    const list = taxRowsForCatalog(catalogUuid, 'service_booking');
    if (!list.length) {
      return { found: false, rate: null, tax: null, reason: 'no_admin_tax_category', score: 0 };
    }
    const candidates = [];
    for (const tc of list) {
      const linked = rolesByTax.get(tc.id) || [];
      if (linked.length === 0) candidates.push({ tc, score: 1 });
      else if (roleId && linked.includes(String(roleId))) candidates.push({ tc, score: 2 });
    }
    if (!candidates.length) {
      return { found: false, rate: money(list[0].tax_rate), tax: list[0], reason: 'role_not_mapped', score: 0 };
    }
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0].tc;
    return {
      found: true,
      rate: money(best.tax_rate),
      tax: best,
      reason: candidates[0].score === 2 ? 'role_match' : 'wildcard',
      score: candidates[0].score,
    };
  }

  const bookedAll = new Map();
  for (const r of await qAll(`
    SELECT b.service_id::text AS id, COUNT(*)::int AS booking_count
    FROM bookings b
    WHERE b.service_id IS NOT NULL
    GROUP BY b.service_id
    ORDER BY 1
  `)) {
    bookedAll.set(r.id, Number(r.booking_count) || 0);
  }

  const services = await qAll(`
    SELECT vs.id::text AS vendor_service_id,
           vs.vendor_id::text AS vendor_id,
           v.business_name,
           v.status AS vendor_status,
           v.is_active AS vendor_active,
           v.vendor_type,
           r.name AS role_name,
           r.id::text AS role_id,
           COALESCE(vs.service_name, sc.service_name, vs.service_id::text) AS service_name,
           vs.is_custom_service,
           vs.price,
           vs.custom_price,
           vs.is_enabled,
           vs.publish_status,
           vs.category AS vs_category,
           vs.category_id::text AS vs_category_id,
           vs.sub_category,
           vs.metadata::text AS vs_metadata,
           sc.id::text AS catalog_row_id,
           sc.service_id AS catalog_service_id,
           sc.category_id AS sc_category_id,
           sc.category_name AS sc_category_name,
           sc.sub_category_id,
           sc.sub_category_name,
           sc.metadata::text AS sc_metadata
    FROM vendor_services vs
    JOIN vendors v ON v.id = vs.vendor_id
    LEFT JOIN roles r ON r.id = v.role_id
    LEFT JOIN service_catalog sc ON sc.id = vs.service_id
    WHERE COALESCE(vs.is_deleted, false) = false
      AND COALESCE(v.is_active, true) = true
      AND (
        LOWER(TRIM(COALESCE(v.status::text, ''))) IN ('approved', 'active', 'activated')
        OR (
          LOWER(TRIM(COALESCE(v.status::text, ''))) = 'pending'
          AND LOWER(TRIM(COALESCE(v.vendor_type::text, ''))) = 'solo'
        )
      )
    ORDER BY vs.id
  `);

  const allRows = [];
  for (const s of services) {
    const vsMeta = parseJson(s.vs_metadata);
    const scMeta = parseJson(s.sc_metadata);
    const explicit =
      vsMeta.gst_catalog_category_id ||
      vsMeta.gst_catalog_category_ref ||
      scMeta.gst_catalog_category_id ||
      scMeta.gst_catalog_category_ref;
    const rawRef =
      explicit ||
      s.sc_category_id ||
      s.vs_category_id ||
      (s.vs_category && String(s.vs_category).toLowerCase() !== 'pet_services' ? s.vs_category : null) ||
      s.sc_category_name ||
      (VET_ROLES.has(String(s.role_name || '').toLowerCase()) ? 'veterinary' : null);
    const cat = resolveCatalog(rawRef);
    const gst = cat
      ? resolveGst(cat.id, s.role_id)
      : { found: false, rate: null, tax: null, reason: 'no_catalog_category', score: 0 };

    const aliasSlug = cat && cat.category_id ? SLUG_ALIASES[String(cat.category_id).toLowerCase()] : null;
    const aliasCat = aliasSlug ? resolveCatalog(aliasSlug) : null;
    const aliasGst = aliasCat ? resolveGst(aliasCat.id, s.role_id) : null;

    const selling = money(s.custom_price != null ? s.custom_price : s.price);
    const pkgInfo = packageMeta(s.vs_metadata) || packageMeta(s.sc_metadata);
    const custom = truthy(s.is_custom_service);
    const enabled = truthy(s.is_enabled);
    const publish = String(s.publish_status || '').toLowerCase();
    const customerFacing =
      enabled && (publish === '' || ['published', 'auto_published', 'draft'].includes(publish));
    const bookingCount = bookedAll.get(s.vendor_service_id) || 0;
    const dummy =
      /dummy|test|placeholder|demo/i.test(String(s.business_name || '')) ||
      /dummy|test|placeholder/i.test(String(s.service_name || '')) ||
      selling <= 10;

    const taxForCat = cat ? taxRowsForCatalog(cat.id, 'service_booking') : [];
    const shownTax = gst.tax || taxForCat[0] || null;
    const allowedRoles = shownTax ? roleNamesByTax.get(shownTax.id) || [] : [];

    let letter = 'H';
    let classification = 'OTHER';
    let likely = '';
    let recommendation = 'BUSINESS DECISION REQUIRED';
    let bothPossibilities = null;

    if (dummy) {
      letter = 'G';
      classification = 'ORPHAN/DUMMY';
      likely = 'Test/dummy vendor, placeholder name, or selling price ≤ ₹10';
      recommendation = 'IGNORE/ARCHIVE TEST DATA';
    } else if (pkgInfo && gst.found === false) {
      letter = 'F';
      classification = 'PACKAGE/SPECIAL';
      likely = 'Package/session structure; GST still resolves via category + role and did not match';
      recommendation = 'BUSINESS DECISION REQUIRED';
    } else if (!gst.found && aliasGst && aliasGst.found) {
      letter = 'A';
      classification = 'RESOLVER BUG';
      likely = `Catalogue slug ${cat.category_id} has no tax row, but alias ${aliasSlug} would match Admin ${aliasGst.tax.category_name} @ ${aliasGst.rate}%`;
      recommendation = 'FIX GST RESOLVER';
    } else if (gst.reason === 'no_catalog_category') {
      if (custom) {
        letter = 'E';
        classification = 'CUSTOM SERVICE';
        likely = 'Vendor-created custom service with no resolvable master/catalogue category';
        recommendation = 'BUSINESS DECISION REQUIRED';
      } else {
        letter = 'C';
        classification = 'CATEGORY DATA GAP';
        likely = 'Standard service has no resolvable catalogue category';
        recommendation = 'FIX CATEGORY ↔ TAX CATEGORY MAPPING';
      }
    } else if (gst.reason === 'no_admin_tax_category') {
      letter = custom ? 'E' : 'H';
      classification = 'CATEGORY DATA GAP';
      likely = `Catalogue category ${cat.category_id || cat.name} exists but no Admin tax_categories.catalog_category_id points at it`;
      recommendation = taxRows.some((t) => !t.catalog_category_id)
        ? 'FIX CATEGORY ↔ TAX CATEGORY MAPPING'
        : 'CREATE NEW TAX CATEGORY';
    } else if (gst.reason === 'role_not_mapped') {
      if (custom) {
        letter = 'D';
        classification = 'CUSTOM SERVICE';
        likely = `Custom service sits under ${cat.category_id || cat.name}; Admin ${shownTax.category_name} roles [${allowedRoles.join(', ') || 'none'}] do not include ${s.role_name}`;
        recommendation = 'BUSINESS DECISION REQUIRED';
      } else {
        letter = 'B';
        classification = 'CONFIG GAP';
        likely = `Admin ${shownTax.category_name} exists @ ${money(shownTax.tax_rate)}% for ${cat.category_id || cat.name}, but applicable roles [${allowedRoles.join(', ') || 'none'}] omit ${s.role_name}`;
        recommendation = 'BUSINESS DECISION REQUIRED';
      }
      bothPossibilities = {
        addRole: `Add ${s.role_name} to Admin tax category ${shownTax.category_name} (${cat.category_id || cat.name})`,
        recategorize: `If this service is not a ${cat.category_id || cat.name} offering, correct the service category instead of changing GST roles`,
      };
    }

    allRows.push({
      vendorId: s.vendor_id,
      vendor: s.business_name,
      vendorRole: s.role_name || '',
      vendorRoleId: s.role_id || '',
      vendorStatus: s.vendor_status || '',
      serviceId: s.vendor_service_id,
      service: s.service_name,
      isCustom: custom,
      isPackage: Boolean(pkgInfo),
      packageId: pkgInfo ? pkgInfo.packageId : null,
      packageName: pkgInfo ? pkgInfo.packageName : null,
      listPrice: money(s.price),
      customPrice: s.custom_price == null ? null : money(s.custom_price),
      sellingPrice: selling,
      categoryId: cat ? cat.id : s.vs_category_id || '',
      categoryName: cat ? cat.name : s.vs_category || s.sc_category_name || '',
      categorySlug: cat ? cat.category_id || '' : String(s.vs_category || s.sc_category_id || ''),
      parentCategory: cat && cat.parent_id && catById.get(String(cat.parent_id))
        ? catById.get(String(cat.parent_id)).name
        : '',
      catalogServiceId: s.catalog_service_id || '',
      catalogRowId: s.catalog_row_id || '',
      rawCategoryRef: rawRef || '',
      adminTaxId: shownTax ? shownTax.id : '',
      adminTaxName: shownTax ? shownTax.category_name : '',
      gstRate: shownTax ? money(shownTax.tax_rate) : null,
      allowedRoles,
      matchReason: gst.reason,
      matchingStatus: gst.found ? gst.reason : `NO_MATCH:${gst.reason}`,
      letter,
      classification,
      likely,
      recommendation,
      bothPossibilities,
      aliasWouldMatch: Boolean(aliasGst && aliasGst.found),
      aliasSlug: aliasSlug || '',
      customerFacing,
      isEnabled: enabled,
      publishStatus: s.publish_status || '',
      historicallyBooked: bookingCount > 0,
      bookingCount,
      dummy,
    });
  }

  const activeGaps = allRows.filter((r) => r.customerFacing && !r.matchingStatus.startsWith('role_match') && !r.matchingStatus.startsWith('wildcard') && r.matchReason !== 'role_match' && r.matchReason !== 'wildcard');
  const inactiveGaps = allRows.filter((r) => !r.customerFacing && ['no_catalog_category', 'no_admin_tax_category', 'role_not_mapped'].includes(r.matchReason));

  function tally(list, keyFn) {
    const o = {};
    for (const r of list) {
      const k = keyFn(r) || 'unknown';
      o[k] = (o[k] || 0) + 1;
    }
    return Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]));
  }

  const taxInventory = taxRows.map((t) => ({
    id: t.id,
    name: t.category_name,
    rate: money(t.tax_rate),
    catalogId: t.catalog_category_id,
    catalogSlug: t.catalog_category_id && catById.get(t.catalog_category_id)
      ? catById.get(t.catalog_category_id).category_id
      : null,
    catalogName: t.catalog_category_id && catById.get(t.catalog_category_id)
      ? catById.get(t.catalog_category_id).name
      : null,
    roles: roleNamesByTax.get(t.id) || [],
    scope: t.gst_application_scope || 'service_booking',
    orphan: !t.catalog_category_id,
  }));

  const usedCatIds = new Set(allRows.filter((r) => r.categoryId).map((r) => r.categoryId));
  const unusedCategories = categories
    .filter((c) => !usedCatIds.has(c.id))
    .map((c) => ({ id: c.id, slug: c.category_id, name: c.name, active: c.is_active }));

  const report = {
    generatedAt: new Date().toISOString(),
    environment: ENVIRONMENT,
    note:
      'Read-only production snapshot. GST match uses current Admin tax_categories + tax_category_roles (no undeployed slug aliases). Customer-facing = enabled + published/auto_published/draft on approved/active vendors (same universe as prior price/GST audit).',
    totals: {
      servicesScanned: allRows.length,
      activeGaps: activeGaps.length,
      inactiveGaps: inactiveGaps.length,
      historicallyBooked: activeGaps.filter((r) => r.historicallyBooked).length,
      neverBooked: activeGaps.filter((r) => !r.historicallyBooked).length,
      custom: activeGaps.filter((r) => r.isCustom).length,
      standard: activeGaps.filter((r) => !r.isCustom).length,
      packages: activeGaps.filter((r) => r.isPackage).length,
      dummy: activeGaps.filter((r) => r.dummy).length,
    },
    byRole: tally(activeGaps, (r) => r.vendorRole),
    byCategory: tally(activeGaps, (r) => r.categorySlug || r.categoryName),
    byPair: tally(activeGaps, (r) => `${r.vendorRole || 'unknown'} + ${r.categorySlug || r.categoryName || 'unknown'}`),
    byLetter: tally(activeGaps, (r) => r.letter),
    byClass: tally(activeGaps, (r) => r.classification),
    byReason: tally(activeGaps, (r) => r.matchReason),
    byCustomRole: tally(
      activeGaps.filter((r) => r.isCustom),
      (r) => r.vendorRole
    ),
    byCustomCategory: tally(
      activeGaps.filter((r) => r.isCustom),
      (r) => r.categorySlug || r.categoryName
    ),
    taxInventory,
    unusedCategories,
    activeGaps,
    inactiveGaps,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        activeGaps: activeGaps.length,
        inactiveGaps: inactiveGaps.length,
        booked: report.totals.historicallyBooked,
        neverBooked: report.totals.neverBooked,
        custom: report.totals.custom,
        packages: report.totals.packages,
        byLetter: report.byLetter,
        byClass: report.byClass,
        byReason: report.byReason,
        topPairs: Object.entries(report.byPair).slice(0, 25),
        out: OUT_PATH,
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
