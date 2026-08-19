#!/usr/bin/env node
/**
 * READ-ONLY post-deploy production GST audit.
 * Simulates the DEPLOYED resolver: category-authoritative + live aliases
 * (behavioral/behavioural → training, lab-diagnostics → diagnostic).
 * Does NOT apply undeployed veterinary_services alias (9d3d11112).
 *
 * Usage: $env:ENVIRONMENT="prod"; node scripts/prod-gst-postdeploy-full-audit.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'prod';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const OUT_PATH = path.join(__dirname, '..', '.tmp-prod-gst-postdeploy-audit.json');

const ECOMMERCE_ROLES = new Set(['ecommerce_seller', 'e_commerce_seller', 'shop_seller', 'product_seller', 'retailer', 'ecommerce']);
const MEAL_SLUGS = new Set(['meal', 'meals', 'meal-plan', 'meal_plan', 'food', 'diet-plan']);
const LIVE_ALIASES = { behavioral: 'training', behavioural: 'training', 'lab-diagnostics': 'diagnostic' };
const VET_ROLES = new Set(['vet_clinic', 'veterinarian', 'vet_solo', 'vet', 'veterinary_clinic', 'solo_vet', 'pet_clinic']);
const CITY_TO_STATE = {
  bangalore: 'karnataka', bengaluru: 'karnataka', mumbai: 'maharashtra', pune: 'maharashtra',
  delhi: 'delhi', hyderabad: 'telangana', chennai: 'tamil nadu',
};
const STATE_ALIASES = {
  ka: 'karnataka', karnataka: 'karnataka', mh: 'maharashtra', maharashtra: 'maharashtra',
  dl: 'delhi', delhi: 'delhi', tn: 'tamil nadu', 'tamil nadu': 'tamil nadu', tg: 'telangana', telangana: 'telangana',
};

function cellValue(field) {
  if (field == null || field.isNull) return null;
  return field.stringValue ?? field.longValue ?? field.doubleValue ?? field.booleanValue ?? null;
}
function rowsFromResult(result) {
  const cols = (result.columnMetadata || []).map((c) => c.name);
  return (result.records || []).map((rec) => {
    const row = {};
    rec.forEach((field, i) => { row[cols[i] || `col_${i}`] = cellValue(field); });
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
  try { const o = JSON.parse(String(raw)); return o && typeof o === 'object' ? o : {}; } catch { return {}; }
}
function isPackageMeta(meta) {
  const m = parseJson(meta);
  const details = parseJson(m.packageDetails);
  return Boolean(m.isPackage || String(m.type || '') === 'package' || String(m.packageType || '') === 'session' || (details && (details.totalSessions || details.sessions)));
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
function truthy(v) { return v === true || v === 'true' || v === 1 || v === '1'; }
function tally(list, keyFn) {
  const o = {};
  for (const r of list) { const k = keyFn(r) || 'unknown'; o[k] = (o[k] || 0) + 1; }
  return Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]));
}
function aliasLive(ref) {
  const raw = String(ref || '').trim().toLowerCase();
  return LIVE_ALIASES[raw] || LIVE_ALIASES[raw.replace(/[\s-]+/g, '_')] || ref;
}
function stateKey(state, city) {
  const st = state != null ? String(state).trim().toLowerCase().replace(/\s+/g, ' ') : '';
  const ct = city != null ? String(city).trim().toLowerCase().replace(/\s+/g, ' ') : '';
  if (st) return STATE_ALIASES[st] || CITY_TO_STATE[st] || st;
  if (ct) return CITY_TO_STATE[ct];
  return undefined;
}
function isInterstate(cKey, vKey) {
  if (!cKey || !vKey) return true;
  return cKey !== vKey;
}

async function main() {
  if (ENVIRONMENT !== 'prod' && process.env.ALLOW_NON_PROD !== '1') {
    console.log('Set ENVIRONMENT=prod');
    process.exit(1);
  }
  const clusterInfo = JSON.parse(execSync(`aws rds describe-db-clusters --db-cluster-identifier warmpawz-${ENVIRONMENT}-cluster --region ${REGION} --output json`, { encoding: 'utf8' }));
  const cluster = clusterInfo.DBClusters[0];
  const sm = new SecretsManagerClient({ region: REGION });
  const secretValue = await sm.send(new GetSecretValueCommand({
    SecretId: 'warmpawz-prod-rds-master-20260207201049162400000001',
  }));
  const client = new RDSDataClient({ region: REGION });
  async function q(sql) {
    const res = await client.send(new ExecuteStatementCommand({
      resourceArn: cluster.DBClusterArn,
      secretArn: secretValue.ARN,
      database: cluster.DatabaseName || 'warmpawz',
      sql,
      includeResultMetadata: true,
    }));
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

  const catCols = (await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='service_categories'`)).map((r) => r.column_name);
  const parentCol = ['parent_id', 'parent_category_id', 'parent_category'].find((c) => catCols.includes(c));
  const categories = await q(`SELECT id::text AS id, category_id, name, is_active ${parentCol ? `, ${parentCol}::text AS parent_id` : `, NULL::text AS parent_id`} FROM service_categories`);
  const catById = new Map(categories.map((c) => [String(c.id), c]));
  const catBySlug = new Map(categories.filter((c) => c.category_id).map((c) => [String(c.category_id).toLowerCase(), c]));
  const catByName = new Map(categories.filter((c) => c.name).map((c) => [String(c.name).toLowerCase().trim(), c]));
  function resolveCatalog(ref) {
    if (!ref) return null;
    const s = String(ref).trim();
    if (catById.has(s)) return catById.get(s);
    const low = s.toLowerCase();
    return catBySlug.get(low) || catByName.get(low) || catBySlug.get(low.replace(/[\s-]+/g, '_')) || null;
  }

  const taxRows = await q(`
    SELECT tc.id::text AS id, tc.category_name, tc.tax_rate, tc.gst_application_scope,
           tc.catalog_category_id::text AS catalog_category_id, tc.is_active
    FROM tax_categories tc WHERE COALESCE(tc.is_active, true) = true
  `);
  const taxRoles = await q(`
    SELECT tcr.tax_category_id::text AS tax_category_id, tcr.role_id::text AS role_id, r.name AS role_name
    FROM tax_category_roles tcr LEFT JOIN roles r ON r.id = tcr.role_id
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
  function pickRate(tc) { return money(tc.tax_rate); }
  function taxRowsForCatalog(catalogUuid) {
    return taxRows.filter((tc) => tc.catalog_category_id && String(tc.catalog_category_id) === String(catalogUuid)
      && String(tc.gst_application_scope || 'service_booking') === 'service_booking');
  }
  function resolveGstOld(catalogUuid, roleId) {
    const list = taxRowsForCatalog(catalogUuid);
    if (!list.length) return { found: false, rate: null, tax: null, reason: 'no_admin_tax_category' };
    const candidates = [];
    for (const tc of list) {
      const linked = rolesByTax.get(tc.id) || [];
      if (linked.length === 0) candidates.push({ tc, score: 1 });
      else if (roleId && linked.includes(String(roleId))) candidates.push({ tc, score: 2 });
    }
    if (!candidates.length) return { found: false, rate: pickRate(list[0]), tax: list[0], reason: 'role_not_mapped' };
    candidates.sort((a, b) => b.score - a.score);
    return { found: true, rate: pickRate(candidates[0].tc), tax: candidates[0].tc, reason: candidates[0].score === 2 ? 'role_match' : 'wildcard' };
  }
  function resolveGstNew(catalogUuid, roleId) {
    const list = taxRowsForCatalog(catalogUuid);
    if (!list.length) return { found: false, rate: null, tax: null, reason: 'no_admin_tax_category' };
    const candidates = list.map((tc) => {
      const linked = rolesByTax.get(tc.id) || [];
      let score = 0;
      if (linked.length === 0) score = 1;
      else if (roleId && linked.includes(String(roleId))) score = 2;
      return { tc, score };
    });
    candidates.sort((a, b) => b.score - a.score || String(a.tc.id).localeCompare(String(b.tc.id)));
    const best = candidates[0].tc;
    return {
      found: true,
      rate: pickRate(best),
      tax: best,
      reason: candidates[0].score === 2 ? 'role_match' : candidates[0].score === 1 ? 'wildcard' : 'category_only',
    };
  }

  const bookedAll = new Map();
  const lastBooked = new Map();
  for (const r of await qAll(`
    SELECT b.service_id::text AS id, COUNT(*)::int AS booking_count, MAX(b.created_at)::text AS last_booking
    FROM bookings b WHERE b.service_id IS NOT NULL GROUP BY b.service_id ORDER BY 1
  `)) {
    bookedAll.set(r.id, Number(r.booking_count) || 0);
    lastBooked.set(r.id, r.last_booking || null);
  }

  let purchaseByService = new Map();
  const tables = (await q(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('package_purchases')`)).map((r) => r.table_name);
  if (tables.includes('package_purchases')) {
    const ppCols = (await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='package_purchases'`)).map((r) => r.column_name);
    const svcCol = ['vendor_service_id', 'service_id'].find((c) => ppCols.includes(c));
    if (svcCol) {
      for (const r of await qAll(`SELECT ${svcCol}::text AS id, COUNT(*)::int AS purchase_count FROM package_purchases WHERE ${svcCol} IS NOT NULL GROUP BY ${svcCol} ORDER BY 1`)) {
        purchaseByService.set(r.id, Number(r.purchase_count) || 0);
      }
    }
  }

  const vendorCols = (await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='vendors'`)).map((r) => r.column_name);
  const vState = vendorCols.includes('state') ? 'v.state' : 'NULL';
  const vCity = vendorCols.includes('city') ? 'v.city' : 'NULL';
  const vGstin = vendorCols.includes('gstin') ? 'v.gstin' : (vendorCols.includes('gst_number') ? 'v.gst_number' : 'NULL');
  const vAddr = vendorCols.includes('address') ? 'v.address::text' : 'NULL';

  const services = await qAll(`
    SELECT vs.id::text AS vendor_service_id, vs.vendor_id::text AS vendor_id, v.business_name,
           v.status AS vendor_status, v.is_active AS vendor_active, v.vendor_type,
           r.name AS role_name, r.id::text AS role_id,
           COALESCE(vs.service_name, sc.service_name, vs.service_id::text) AS service_name,
           vs.is_custom_service, vs.price, vs.custom_price, vs.is_enabled, vs.publish_status,
           vs.category AS vs_category, vs.category_id::text AS vs_category_id,
           vs.metadata::text AS vs_metadata,
           sc.id::text AS catalog_row_id, sc.service_id AS catalog_service_id,
           sc.category_id AS sc_category_id, sc.category_name AS sc_category_name,
           sc.metadata::text AS sc_metadata, sc.base_price AS catalog_base_price,
           ${vState} AS vendor_state, ${vCity} AS vendor_city, ${vGstin} AS vendor_gstin, ${vAddr} AS vendor_address
    FROM vendor_services vs
    JOIN vendors v ON v.id = vs.vendor_id
    LEFT JOIN roles r ON r.id = v.role_id
    LEFT JOIN service_catalog sc ON sc.id = vs.service_id
    WHERE COALESCE(vs.is_deleted, false) = false
      AND COALESCE(v.is_active, true) = true
      AND (
        LOWER(TRIM(COALESCE(v.status::text, ''))) IN ('approved', 'active', 'activated')
        OR (LOWER(TRIM(COALESCE(v.status::text, ''))) = 'pending' AND LOWER(TRIM(COALESCE(v.vendor_type::text, ''))) = 'solo')
      )
    ORDER BY vs.id
  `);

  const allRows = [];
  let ecommerceSkipped = 0;
  let mealSkipped = 0;
  for (const s of services) {
    const roleName = String(s.role_name || '').toLowerCase();
    if (ECOMMERCE_ROLES.has(roleName) || roleName.includes('ecommerce')) { ecommerceSkipped += 1; continue; }
    const vsMeta = parseJson(s.vs_metadata);
    const scMeta = parseJson(s.sc_metadata);
    const explicit = vsMeta.gst_catalog_category_id || vsMeta.gst_catalog_category_ref || scMeta.gst_catalog_category_id || scMeta.gst_catalog_category_ref;
    const rawRef = explicit || s.sc_category_id || s.vs_category_id
      || (s.vs_category && String(s.vs_category).toLowerCase() !== 'pet_services' ? s.vs_category : null)
      || s.sc_category_name
      || (VET_ROLES.has(roleName) ? 'veterinary' : null);
    const aliased = rawRef ? aliasLive(String(rawRef)) : null;
    const cat = resolveCatalog(aliased) || resolveCatalog(rawRef);
    const slug = cat && cat.category_id ? String(cat.category_id).toLowerCase() : '';
    if (MEAL_SLUGS.has(slug)) { mealSkipped += 1; continue; }

    const oldGst = cat ? resolveGstOld(cat.id, s.role_id) : { found: false, rate: null, tax: null, reason: 'no_catalog_category' };
    const newGst = cat ? resolveGstNew(cat.id, s.role_id) : { found: false, rate: null, tax: null, reason: 'no_catalog_category' };
    const selling = money(s.custom_price != null ? s.custom_price : s.price);
    const pkgInfo = packageMeta(s.vs_metadata) || packageMeta(s.sc_metadata);
    const custom = truthy(s.is_custom_service);
    const enabled = truthy(s.is_enabled);
    const publish = String(s.publish_status || '').toLowerCase();
    const customerFacing = enabled && (publish === '' || ['published', 'auto_published', 'draft'].includes(publish));
    const bookingCount = bookedAll.get(s.vendor_service_id) || 0;
    const dummy = /dummy|test|placeholder|demo/i.test(String(s.business_name || '')) || /dummy|test|placeholder/i.test(String(s.service_name || '')) || selling <= 10;
    const shownTax = newGst.tax || oldGst.tax || (cat ? taxRowsForCatalog(cat.id)[0] : null);
    const resolvedByCategoryOnly = customerFacing && !oldGst.found && oldGst.reason === 'role_not_mapped' && newGst.found;
    const vStateKey = stateKey(s.vendor_state, s.vendor_city);
    const bangaloreVendor = /bangalore|bengaluru/i.test(`${s.vendor_city || ''} ${s.vendor_state || ''} ${s.vendor_address || ''}`);

    allRows.push({
      vendorId: s.vendor_id, vendor: s.business_name, vendorRole: s.role_name || '', vendorRoleId: s.role_id || '',
      vendorStatus: s.vendor_status || '', vendorState: s.vendor_state || '', vendorCity: s.vendor_city || '',
      vendorGstin: s.vendor_gstin || '', vendorStateKey: vStateKey || '', bangaloreVendor,
      serviceId: s.vendor_service_id, service: s.service_name, isCustom: custom, isPackage: Boolean(pkgInfo),
      packageId: pkgInfo ? pkgInfo.packageId : null, sessions: pkgInfo ? pkgInfo.totalSessions : null,
      listPrice: money(s.price), customPrice: s.custom_price == null ? null : money(s.custom_price),
      sellingPrice: selling, priceSource: s.custom_price != null ? 'custom_price' : 'price',
      catalogBasePrice: s.catalog_base_price == null ? null : money(s.catalog_base_price),
      categoryId: cat ? cat.id : '', categoryName: cat ? cat.name : (s.vs_category || s.sc_category_name || ''),
      categorySlug: cat ? (cat.category_id || '') : String(s.vs_category || s.sc_category_id || ''),
      rawCategoryRef: rawRef || '', aliasedRef: aliased || '',
      adminTaxId: shownTax ? shownTax.id : '', adminTaxName: shownTax ? shownTax.category_name : '',
      gstRate: newGst.found ? newGst.rate : null,
      oldReason: oldGst.reason, oldFound: oldGst.found, newReason: newGst.reason, newFound: newGst.found,
      resolvedByCategoryOnly, customerFacing, dummy,
      historicallyBooked: bookingCount > 0, bookingCount, lastBooking: lastBooked.get(s.vendor_service_id) || null,
      purchaseCount: purchaseByService.get(s.vendor_service_id) || 0,
    });
  }

  const facing = allRows.filter((r) => r.customerFacing);
  const servicesF = facing.filter((r) => !r.isPackage);
  const packagesF = facing.filter((r) => r.isPackage);
  const oldGaps = facing.filter((r) => !r.oldFound);
  const newGaps = facing.filter((r) => !r.newFound);
  const resolved = facing.filter((r) => r.resolvedByCategoryOnly);

  function classify(r) {
    if (r.dummy && !r.newFound) return 'G';
    if (r.newReason === 'no_catalog_category') return r.isCustom ? 'E' : 'C';
    if (r.newReason === 'no_admin_tax_category') return 'B';
    if (r.isPackage && !r.newFound) return 'F';
    if (r.isCustom && !r.newFound) return 'D';
    return r.newFound ? 'OK' : 'H';
  }

  const remainingGroups = {};
  for (const r of newGaps) {
    const key = `${r.categorySlug || r.categoryName || '(no category)'} | ${r.vendorRole || '(no role)'} | ${r.newReason}`;
    if (!remainingGroups[key]) {
      remainingGroups[key] = {
        category: r.categoryName || '', categorySlug: r.categorySlug || '', categoryId: r.categoryId || '',
        vendorRole: r.vendorRole || '', roleId: r.vendorRoleId || '', reason: r.newReason,
        adminTax: r.adminTaxName || '', gstRate: r.gstRate, vendors: new Set(),
        services: 0, packages: 0, booked: 0, unbooked: 0, custom: 0, standard: 0, letter: classify(r), samples: [],
      };
    }
    const g = remainingGroups[key];
    g.vendors.add(r.vendorId);
    if (r.isPackage) g.packages += 1; else g.services += 1;
    if (r.historicallyBooked) g.booked += 1; else g.unbooked += 1;
    if (r.isCustom) g.custom += 1; else g.standard += 1;
    if (g.samples.length < 6) g.samples.push({ vendor: r.vendor, service: r.service, serviceId: r.serviceId, sell: r.sellingPrice, booked: r.bookingCount, pkg: r.isPackage, custom: r.isCustom });
  }
  const remaining = Object.values(remainingGroups).map((g) => ({ ...g, vendorCount: g.vendors.size, vendors: undefined }))
    .sort((a, b) => b.services + b.packages - (a.services + a.packages));

  const matrixMap = {};
  for (const r of facing) {
    const key = `${r.categorySlug || r.categoryName || '(none)'} | ${r.vendorRole || '(none)'}`;
    if (!matrixMap[key]) {
      matrixMap[key] = {
        category: r.categoryName || '', categorySlug: r.categorySlug || '', categoryId: r.categoryId || '',
        vendorRole: r.vendorRole || '', roleId: r.vendorRoleId || '', vendors: new Set(),
        services: 0, packages: 0, gstCard: r.adminTaxName || '', gstRate: r.newFound ? r.newRate || r.gstRate : r.gstRate,
        resolves: 0, missing: 0, oldRoleGaps: 0, resolvedByCategoryOnly: 0,
      };
    }
    const m = matrixMap[key];
    m.vendors.add(r.vendorId);
    if (r.isPackage) m.packages += 1; else m.services += 1;
    if (r.newFound) m.resolves += 1; else m.missing += 1;
    if (r.oldReason === 'role_not_mapped') m.oldRoleGaps += 1;
    if (r.resolvedByCategoryOnly) m.resolvedByCategoryOnly += 1;
    if (!m.gstCard && r.adminTaxName) m.gstCard = r.adminTaxName;
  }
  const matrix = Object.values(matrixMap).map((m) => ({
    ...m, vendors: m.vendors.size,
    resolvesYes: m.missing === 0,
    gapReason: m.missing === 0 ? (m.resolvedByCategoryOnly > 0 ? 'RESOLVED_BY_CATEGORY_ONLY' : '') : 'see remaining',
  })).sort((a, b) => b.services + b.packages - (a.services + a.packages));

  const saraLike = facing.filter((r) => {
    if (r.catalogBasePrice == null || r.catalogBasePrice <= 0 || r.sellingPrice <= 0) return false;
    if (r.customPrice != null) return false;
    const commission10 = r.catalogBasePrice * 0.9;
    return Math.abs(r.sellingPrice - commission10) < 1 && r.sellingPrice < r.catalogBasePrice;
  });

  const diagnostic = facing.filter((r) => /diagnostic|lab-diagnostic/i.test(`${r.categorySlug} ${r.categoryName} ${r.rawCategoryRef}`));
  const behavioral = facing.filter((r) => /behavio|training/i.test(`${r.categorySlug} ${r.categoryName} ${r.rawCategoryRef} ${r.aliasedRef}`));

  const payCols = (await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='payments'`)).map((r) => r.column_name);
  const hasIgst = payCols.includes('igst_amount');
  const hasCgst = payCols.includes('cgst_amount');
  const hasInter = payCols.includes('is_inter_state');
  let paymentState = { rows: [], bangaloreIgst: [], missingStateIgst: [], intraOk: 0, interOk: 0, mismatch: 0 };
  if (hasIgst && hasCgst) {
    const interSel = hasInter ? 'p.is_inter_state' : 'NULL';
    const payRows = await qAll(`
      SELECT p.id::text AS payment_id, p.vendor_id::text AS vendor_id, v.business_name,
             ${vState} AS vendor_state, ${vCity} AS vendor_city,
             p.cgst_amount, p.sgst_amount, p.igst_amount, p.gst_amount, ${interSel} AS is_inter_state,
             p.created_at::text AS created_at
      FROM payments p
      JOIN vendors v ON v.id = p.vendor_id
      WHERE p.created_at >= NOW() - INTERVAL '45 days'
        AND COALESCE(p.gst_amount, 0) > 0
      ORDER BY p.created_at DESC
    `);
    for (const p of payRows) {
      const vKey = stateKey(p.vendor_state, p.vendor_city);
      const igst = money(p.igst_amount);
      const cgst = money(p.cgst_amount);
      const sgst = money(p.sgst_amount);
      const gst = money(p.gst_amount);
      const storedInter = p.is_inter_state;
      const bangalore = /bangalore|bengaluru/i.test(`${p.vendor_city || ''} ${p.vendor_state || ''}`);
      const actualInter = igst > 0.009 && cgst + sgst <= 0.009;
      const actualIntra = cgst + sgst > 0.009 && igst <= 0.009;
      const splitOk = Math.abs((cgst + sgst + igst) - gst) < 1 || gst === 0;
      const row = {
        paymentId: p.payment_id, vendor: p.business_name, vendorId: p.vendor_id,
        vendorState: p.vendor_state || '', vendorCity: p.vendor_city || '', vendorStateKey: vKey || '',
        bangalore, cgst, sgst, igst, gst, storedInter, actualInter, actualIntra, splitOk, createdAt: p.created_at,
      };
      paymentState.rows.push(row);
      if (actualIntra) paymentState.intraOk += 1;
      if (actualInter) paymentState.interOk += 1;
      if (bangalore && actualInter) paymentState.bangaloreIgst.push(row);
      if (!vKey && actualInter) paymentState.missingStateIgst.push(row);
    }
  }

  const bangaloreVendors = facing.filter((r) => r.bangaloreVendor);
  const bangaloreVendorStates = tally(bangaloreVendors, (r) => r.vendorStateKey || `(raw:${r.vendorState || r.vendorCity || 'empty'})`);

  const taxInventory = taxRows.map((t) => ({
    id: t.id, name: t.category_name, rate: pickRate(t), catalogId: t.catalog_category_id,
    catalogSlug: t.catalog_category_id && catById.get(t.catalog_category_id) ? catById.get(t.catalog_category_id).category_id : null,
    catalogName: t.catalog_category_id && catById.get(t.catalog_category_id) ? catById.get(t.catalog_category_id).name : null,
    roles: roleNamesByTax.get(t.id) || [], scope: t.gst_application_scope || 'service_booking',
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    environment: ENVIRONMENT,
    deployedNote: 'Simulates LIVE prod resolver: category-only + aliases behavioral/lab-diagnostics. Does NOT apply undeployed veterinary_services alias 9d3d11112.',
    historicalBaseline: 261,
    skipped: { ecommerceSkipped, mealSkipped },
    totals: {
      scanned: allRows.length, customerFacing: facing.length,
      services: servicesF.length, packages: packagesF.length,
      custom: facing.filter((r) => r.isCustom).length, standard: facing.filter((r) => !r.isCustom).length,
      booked: facing.filter((r) => r.historicallyBooked).length, neverBooked: facing.filter((r) => !r.historicallyBooked).length,
      dummy: facing.filter((r) => r.dummy).length,
      oldUnresolved: oldGaps.length, newUnresolved: newGaps.length,
      resolvedByCategoryOnly: resolved.length, newlyUnresolved: facing.filter((r) => r.oldFound && !r.newFound).length,
      servicesResolving: servicesF.filter((r) => r.newFound).length, servicesFailing: servicesF.filter((r) => !r.newFound).length,
      packagesResolving: packagesF.filter((r) => r.newFound).length, packagesFailing: packagesF.filter((r) => !r.newFound).length,
      customResolving: facing.filter((r) => r.isCustom && r.newFound).length,
      customFailing: facing.filter((r) => r.isCustom && !r.newFound).length,
      standardResolving: facing.filter((r) => !r.isCustom && r.newFound).length,
      standardFailing: facing.filter((r) => !r.isCustom && !r.newFound).length,
    },
    oldByReason: tally(oldGaps, (r) => r.oldReason),
    newByReason: tally(newGaps, (r) => r.newReason),
    newByLetter: tally(newGaps, (r) => classify(r)),
    resolvedByPair: tally(resolved, (r) => `${r.categorySlug || r.categoryName} + ${r.vendorRole}`),
    remaining,
    matrix,
    diagnostic: {
      count: diagnostic.length,
      oldUnresolved: diagnostic.filter((r) => !r.oldFound).length,
      newUnresolved: diagnostic.filter((r) => !r.newFound).length,
      byRole: tally(diagnostic, (r) => r.vendorRole),
      byNewReason: tally(diagnostic.filter((r) => !r.newFound), (r) => r.newReason),
      cards: taxInventory.filter((t) => /diagnostic/i.test(`${t.name} ${t.catalogSlug}`)),
    },
    behavioral: {
      count: behavioral.length,
      oldUnresolved: behavioral.filter((r) => !r.oldFound).length,
      newUnresolved: behavioral.filter((r) => !r.newFound).length,
      bySlug: tally(behavioral, (r) => r.categorySlug || r.categoryName),
      byRole: tally(behavioral, (r) => r.vendorRole),
      byNewReason: tally(behavioral.filter((r) => !r.newFound), (r) => r.newReason),
      cards: taxInventory.filter((t) => /train|behav/i.test(`${t.name} ${t.catalogSlug}`)),
      unresolved: behavioral.filter((r) => !r.newFound).map((r) => ({
        vendor: r.vendor, role: r.vendorRole, service: r.service, slug: r.categorySlug, raw: r.rawCategoryRef,
        aliased: r.aliasedRef, reason: r.newReason, pkg: r.isPackage, sell: r.sellingPrice, booked: r.bookingCount,
      })),
    },
    packageFail: packagesF.filter((r) => !r.newFound).map((r) => ({
      vendor: r.vendor, role: r.vendorRole, service: r.service, serviceId: r.serviceId,
      cat: r.categoryName, slug: r.categorySlug, raw: r.rawCategoryRef, reason: r.newReason,
      sell: r.sellingPrice, sessions: r.sessions, purchases: r.purchaseCount, custom: r.isCustom,
    })),
    saraLikeCount: saraLike.length,
    saraLike: saraLike.slice(0, 20),
    taxInventory,
    bangaloreVendorStates,
    bangaloreVendorCount: new Set(bangaloreVendors.map((r) => r.vendorId)).size,
    paymentState: {
      paymentsWithGst45d: paymentState.rows.length,
      intraOk: paymentState.intraOk,
      interOk: paymentState.interOk,
      bangaloreIgstCount: paymentState.bangaloreIgst.length,
      missingVendorStateIgst: paymentState.missingStateIgst.length,
      bangaloreIgst: paymentState.bangaloreIgst.slice(0, 40),
      splitBroken: paymentState.rows.filter((r) => !r.splitOk).length,
    },
    unresolvedRows: newGaps.map((r) => ({
      vendor: r.vendor, role: r.vendorRole, roleId: r.vendorRoleId, service: r.service, serviceId: r.serviceId,
      custom: r.isCustom, pkg: r.isPackage, cat: r.categoryName, slug: r.categorySlug, catId: r.categoryId,
      tax: r.adminTaxName, rate: r.gstRate, reason: r.newReason, letter: classify(r),
      booked: r.bookingCount, sell: r.sellingPrice, priceSource: r.priceSource,
    })),
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    customerFacing: facing.length,
    oldUnresolved: oldGaps.length,
    newUnresolved: newGaps.length,
    resolvedByCategoryOnly: resolved.length,
    servicesFailing: report.totals.servicesFailing,
    packagesFailing: report.totals.packagesFailing,
    oldByReason: report.oldByReason,
    newByReason: report.newByReason,
    diagnosticNewU: report.diagnostic.newUnresolved,
    behavioralNewU: report.behavioral.newUnresolved,
    saraLike: report.saraLikeCount,
    bangaloreIgst: report.paymentState.bangaloreIgstCount,
    out: OUT_PATH,
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
