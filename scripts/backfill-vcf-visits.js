/**
 * Backfill promo-engine V/C/F visit counts from historical transactions (dev or prod).
 *
 * Source of truth (mirrors backend/lambda/src/discount-engine/promo-engine/services/visit-writer.service.ts):
 *   - Pay Bill: payments.payment_source='warmpawz_pay', payment_status='completed', completed_at set.
 *     referenceId = payments.id, channel 'paybill'.
 *   - Bookings: bookings.status='completed'. Channel from service_style || service_type
 *     (tele / appointment; other styles are not visits). referenceId = bookings.id.
 *   - Customer key: customer_id (never name or phone).
 *   - Category: payment metadata / booking category when it is a real service_categories.id, else the
 *     first catalogue row (active first, display_order, id) whose vendor_roles lists the vendor's role
 *     id or name. Deleted vendors resolve no role, so no category (platform + vendor still count).
 *
 * Writes (only with --apply):
 *   1. One VCF_VISIT event per transaction that has none (same idempotency check as the live writer).
 *   2. services.vcf rebuilt for every user from VCF_VISIT minus VCF_VISIT_REVERSE events; other keys
 *      under services and the overall column are kept.
 *   3. Re-reads stored profiles and fails if any count differs from the event log.
 * Re-running is safe: already-recorded transactions are skipped and profiles are rebuilt identically.
 * After deploy the live writer keeps appending events and bumping the same profile shape.
 *
 * Modes:
 *   (default)            dry run, writes nothing, saves an audit workbook
 *   --preview-role-map   dry run only: apply migration 1120/1121 role mapping in memory
 *   --apply              write events + profiles (prod also needs --confirm-prod)
 *   --verify             compare stored profiles with the event log (no writes)
 *   --out <dir>          report folder (default reports/vcf-backfill)
 *
 *   $env:ENVIRONMENT='prod'; $env:AWS_PROFILE='cursor-agent'
 *   node scripts/backfill-vcf-visits.js --preview-role-map
 *   node scripts/backfill-vcf-visits.js --apply --confirm-prod
 *   node scripts/backfill-vcf-visits.js --verify
 */
const fs = require('fs');
const path = require('path');
const { query, executeSQL, ENVIRONMENT } = require('./rds-data-api-utils-dev');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const VERIFY = args.includes('--verify');
const CONFIRM_PROD = args.includes('--confirm-prod');
const PREVIEW_ROLE_MAP = args.includes('--preview-role-map');
const OUT_DIR = (() => {
  const i = args.indexOf('--out');
  return i >= 0 && args[i + 1] ? args[i + 1] : path.join(__dirname, '..', 'reports', 'vcf-backfill');
})();
const BATCH = 50;

const COUNT_CHANNELS = ['tele', 'appointment', 'paybill', 'ecommerce'];
const GENERAL = ['tele', 'appointment', 'paybill'];
const TELE = new Set(['tele', 'video_consultation', 'video', 'online', 'online_consultation']);
const APPOINTMENT = new Set(['appointment', 'at_center', 'at_clinic', 'at_home', 'home_visit', 'clinic', 'center']);

function esc(s) {
  return String(s).replace(/'/g, "''");
}

function sqlStr(v) {
  return v == null ? 'NULL' : `'${esc(v)}'`;
}

function token(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
}

function bookingChannel(style) {
  const t = token(style);
  if (TELE.has(t)) return 'tele';
  if (APPOINTMENT.has(t)) return 'appointment';
  return null;
}

function rolesOnCategory(raw) {
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  const s = String(raw || '').trim();
  if (!s) return [];
  if (s.startsWith('{') && s.endsWith('}')) {
    return s
      .slice(1, -1)
      .split(',')
      .map((x) => x.replace(/^"|"$/g, '').trim())
      .filter(Boolean);
  }
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
  } catch {
    return s.split(',').map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

function categoryFromRole(roleId, roleName, catalogue) {
  const tokens = new Set();
  const id = String(roleId || '').trim();
  const name = String(roleName || '').trim();
  if (id) tokens.add(id.toLowerCase());
  if (name) {
    tokens.add(name.toLowerCase());
    tokens.add(name.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
  }
  if (!tokens.size) return null;
  for (const row of catalogue) {
    if (row.roles.some((r) => tokens.has(r.toLowerCase()))) return row.id;
  }
  return null;
}

function resolveCategory(explicit, roleId, roleName, catalogue, catalogueIds) {
  const booked = String(explicit || '').trim();
  if (booked && catalogueIds.has(booked)) return booked;
  return categoryFromRole(roleId, roleName, catalogue);
}

function emptyCells() {
  const out = {};
  for (const ch of COUNT_CHANNELS) out[ch] = { count: 0, lastAt: null };
  return out;
}

function parseJson(v) {
  if (v == null) return {};
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(v);
  } catch {
    return {};
  }
}

async function tableExists(name) {
  const rows = await query(`SELECT to_regclass('public.${name}')::text AS t`);
  return Boolean(rows[0] && rows[0].t);
}

async function loadCatalogue() {
  const rows = await query(`
    SELECT id::text AS id, vendor_roles::text AS vendor_roles, name, category_id AS slug
    FROM service_categories
    ORDER BY COALESCE(is_active, true) DESC, display_order ASC NULLS LAST, id`);
  return rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, roles: rolesOnCategory(r.vendor_roles) }));
}

/** Role mapping from db/migrations/1121 (and the 1120 seller rule), applied in memory for previews. */
function applyMigrationRoleMap(catalogue) {
  const file = path.join(__dirname, '..', 'db', 'migrations', '1121_service_categories_core_vendor_roles.sql');
  const sql = fs.readFileSync(file, 'utf8');
  const bySlug = {};
  for (const m of sql.matchAll(/\('([a-z0-9-]+)',\s*'([a-z0-9_]+)'\)/g)) {
    (bySlug[m[1]] = bySlug[m[1]] || []).push(m[2]);
  }
  return catalogue.map((c) => {
    const roles = new Set(c.roles);
    for (const r of bySlug[c.slug] || []) roles.add(r);
    const lowerName = String(c.name || '').trim().toLowerCase();
    if (c.roles.some((r) => ['shop', 'pet_shop'].includes(r)) || ['pet shop', 'pet products'].includes(lowerName)) {
      roles.add('seller');
    }
    return { ...c, roles: [...roles] };
  });
}

async function loadCandidates(catalogue) {
  const catalogueIds = new Set(catalogue.map((c) => c.id));
  const pays = await query(`
    SELECT p.id::text AS id, p.customer_id::text AS customer_id, p.vendor_id::text AS vendor_id,
           p.completed_at::text AS at,
           to_char(p.completed_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') AS at_ist,
           p.original_amount::text AS amount,
           COALESCE(p.metadata->>'categoryId', p.metadata->>'bookingCategoryId') AS explicit_category,
           c.full_name AS customer_name, c.phone AS customer_phone,
           v.business_name, v.is_deleted AS vendor_deleted,
           CASE WHEN v.is_deleted IS NOT TRUE THEN v.role_id::text END AS role_id,
           CASE WHEN v.is_deleted IS NOT TRUE THEN r.name END AS role_name,
           r.name AS raw_role_name
    FROM payments p
    LEFT JOIN customers c ON c.id = p.customer_id
    LEFT JOIN vendors v ON v.id = p.vendor_id
    LEFT JOIN roles r ON r.id = v.role_id
    WHERE p.payment_source = 'warmpawz_pay'
      AND p.payment_status = 'completed'
      AND p.completed_at IS NOT NULL
      AND p.customer_id IS NOT NULL
    ORDER BY p.completed_at ASC`);

  const bookings = await query(`
    SELECT b.id::text AS id, b.customer_id::text AS customer_id, b.vendor_id::text AS vendor_id,
           COALESCE(b.completed_at, b.updated_at, b.created_at)::text AS at,
           to_char(COALESCE(b.completed_at, b.updated_at, b.created_at) AT TIME ZONE 'Asia/Kolkata',
                   'YYYY-MM-DD HH24:MI') AS at_ist,
           b.total_amount::text AS amount,
           COALESCE(NULLIF(b.service_style, ''), b.service_type) AS style,
           b.service_category::text AS explicit_category,
           c.full_name AS customer_name, c.phone AS customer_phone,
           v.business_name, v.is_deleted AS vendor_deleted,
           CASE WHEN v.is_deleted IS NOT TRUE THEN v.role_id::text END AS role_id,
           CASE WHEN v.is_deleted IS NOT TRUE THEN r.name END AS role_name,
           r.name AS raw_role_name
    FROM bookings b
    LEFT JOIN customers c ON c.id = b.customer_id
    LEFT JOIN vendors v ON v.id = b.vendor_id
    LEFT JOIN roles r ON r.id = v.role_id
    WHERE b.status = 'completed'
      AND b.customer_id IS NOT NULL
    ORDER BY 4 ASC`);

  const out = [];
  const skipped = { booking_not_visit_channel: 0 };
  const toVisit = (row, source, channel) => ({
    source,
    userId: row.customer_id,
    referenceId: row.id,
    channel,
    vendorId: row.vendor_id || null,
    categoryId: resolveCategory(row.explicit_category, row.role_id, row.role_name, catalogue, catalogueIds),
    roleId: row.role_id || null,
    roleName: row.raw_role_name || null,
    vendorDeleted: row.vendor_deleted === true || row.vendor_deleted === 'true',
    customerName: row.customer_name || '',
    customerPhone: row.customer_phone || '',
    vendorName: row.business_name || '',
    amount: row.amount != null ? Number(row.amount) : null,
    at: row.at,
    atIst: row.at_ist,
    style: row.style || null,
  });
  for (const p of pays) out.push(toVisit(p, 'Pay Bill', 'paybill'));
  for (const b of bookings) {
    const channel = bookingChannel(b.style);
    if (!channel) {
      skipped.booking_not_visit_channel += 1;
      continue;
    }
    out.push(toVisit(b, 'Booking', channel));
  }
  return { candidates: out, skipped, pays: pays.length, bookings: bookings.length };
}

async function loadExistingVisitKeys(eventsExist) {
  if (!eventsExist) return new Set();
  const rows = await query(`
    SELECT user_id, payload->>'referenceId' AS ref
    FROM customer_behaviour_events
    WHERE event_type = 'VCF_VISIT'`);
  return new Set(rows.map((r) => `${r.user_id}|${r.ref}`));
}

function buildProfiles(visits) {
  const profiles = new Map();
  for (const v of visits) {
    if (!COUNT_CHANNELS.includes(v.channel)) continue;
    let p = profiles.get(v.userId);
    if (!p) {
      p = { platform: emptyCells(), categories: {}, vendors: {} };
      profiles.set(v.userId, p);
    }
    const bump = (cell) => ({
      count: cell.count + 1,
      lastAt: !cell.lastAt || String(v.at) > cell.lastAt ? String(v.at) : cell.lastAt,
    });
    p.platform[v.channel] = bump(p.platform[v.channel]);
    if (v.categoryId) {
      p.categories[v.categoryId] = p.categories[v.categoryId] || emptyCells();
      p.categories[v.categoryId][v.channel] = bump(p.categories[v.categoryId][v.channel]);
    }
    if (v.vendorId) {
      const cur = p.vendors[v.vendorId] || { categoryId: '', roleId: '', ...emptyCells() };
      p.vendors[v.vendorId] = {
        ...cur,
        categoryId: v.categoryId || cur.categoryId || '',
        roleId: v.roleId || cur.roleId || '',
        [v.channel]: bump(cur[v.channel]),
      };
    }
  }
  return profiles;
}

async function insertEvents(rows) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const values = rows.slice(i, i + BATCH).map((v) => {
      const payload = JSON.stringify({
        referenceId: v.referenceId,
        channel: v.channel,
        vendorId: v.vendorId,
        categoryId: v.categoryId,
        roleId: v.roleId,
        backfill: true,
      });
      return `(${sqlStr(v.userId)}, 'VCF_VISIT', ${sqlStr(v.channel)}, '${esc(payload)}'::jsonb, ${
        v.at ? `${sqlStr(v.at)}::timestamptz` : 'NOW()'
      })`;
    });
    await executeSQL(`
      INSERT INTO customer_behaviour_events (user_id, event_type, service_key, payload, created_at)
      VALUES ${values.join(',\n')}`);
  }
}

async function loadEffectiveVisits() {
  const rows = await query(`
    SELECT e.user_id, e.payload::text AS payload, e.created_at::text AS created_at
    FROM customer_behaviour_events e
    WHERE e.event_type = 'VCF_VISIT'
      AND NOT EXISTS (
        SELECT 1 FROM customer_behaviour_events r
        WHERE r.event_type = 'VCF_VISIT_REVERSE'
          AND r.user_id = e.user_id
          AND r.payload->>'referenceId' = e.payload->>'referenceId'
      )
    ORDER BY e.created_at ASC`);
  return rows.map((r) => {
    const p = parseJson(r.payload);
    return {
      userId: r.user_id,
      referenceId: p.referenceId,
      channel: p.channel,
      vendorId: p.vendorId || null,
      categoryId: p.categoryId || null,
      roleId: p.roleId || null,
      at: r.created_at,
    };
  });
}

async function upsertProfiles(profiles) {
  const entries = [...profiles.entries()];
  for (let i = 0; i < entries.length; i += BATCH) {
    const values = entries
      .slice(i, i + BATCH)
      .map(
        ([userId, vcf]) =>
          `(${sqlStr(userId)}, '{}'::jsonb, jsonb_build_object('vcf', '${esc(JSON.stringify(vcf))}'::jsonb))`
      );
    await executeSQL(`
      INSERT INTO customer_behaviour_profiles (user_id, overall, services)
      VALUES ${values.join(',\n')}
      ON CONFLICT (user_id) DO UPDATE
      SET services = COALESCE(customer_behaviour_profiles.services, '{}'::jsonb)
                     || jsonb_build_object('vcf', EXCLUDED.services->'vcf'),
          updated_at = NOW()`);
  }
}

/** Flatten a vcf profile to "scope|id|channel" → count (non-zero only). */
function flattenCounts(vcf) {
  const out = new Map();
  const add = (k, n) => {
    if (n) out.set(k, n);
  };
  const p = vcf || {};
  for (const ch of COUNT_CHANNELS) add(`F||${ch}`, Number(p.platform?.[ch]?.count || 0));
  for (const [id, cells] of Object.entries(p.categories || {})) {
    for (const ch of COUNT_CHANNELS) add(`C|${id}|${ch}`, Number(cells?.[ch]?.count || 0));
  }
  for (const [id, cells] of Object.entries(p.vendors || {})) {
    for (const ch of COUNT_CHANNELS) add(`V|${id}|${ch}`, Number(cells?.[ch]?.count || 0));
  }
  return out;
}

async function compareStoredWithEvents() {
  const expected = buildProfiles(await loadEffectiveVisits());
  const stored = await query(`
    SELECT user_id, (services->'vcf')::text AS vcf
    FROM customer_behaviour_profiles
    WHERE services ? 'vcf'`);
  const storedMap = new Map(stored.map((r) => [r.user_id, parseJson(r.vcf)]));
  const mismatches = [];
  const users = new Set([...expected.keys(), ...storedMap.keys()]);
  for (const userId of users) {
    const e = flattenCounts(expected.get(userId));
    const s = flattenCounts(storedMap.get(userId));
    for (const k of new Set([...e.keys(), ...s.keys()])) {
      if ((e.get(k) || 0) !== (s.get(k) || 0)) {
        mismatches.push({ userId, cell: k, eventLog: e.get(k) || 0, stored: s.get(k) || 0 });
      }
    }
  }
  return { usersChecked: users.size, mismatches };
}

function phone10(p) {
  return String(p || '').replace(/\D/g, '').slice(-10);
}

async function writeReport({ candidates, existing, profiles, catalogue, meta }) {
  const ExcelJS = require(path.join(__dirname, '..', 'backend', 'lambda', 'node_modules', 'exceljs'));
  const names = new Map(catalogue.map((c) => [c.id, c.name]));
  const people = new Map();
  for (const v of candidates) {
    if (!people.has(v.userId)) people.set(v.userId, { name: v.customerName, phone: phone10(v.customerPhone) });
  }
  const vendorNames = new Map(candidates.filter((v) => v.vendorId).map((v) => [v.vendorId, v.vendorName]));

  const usedCats = catalogue.filter((c) => [...profiles.values()].some((p) => p.categories[c.id]));
  const wb = new ExcelJS.Workbook();

  const summary = wb.addWorksheet('Summary');
  summary.columns = [{ header: 'Item', key: 'k', width: 46 }, { header: 'Value', key: 'v', width: 60 }];
  for (const [k, v] of Object.entries(meta)) summary.addRow({ k, v: typeof v === 'object' ? JSON.stringify(v) : v });
  summary.addRow({});
  summary.addRow({ k: 'How to read', v: 'Counts are per customer account (customer_id), never by name.' });
  summary.addRow({ k: 'Next visit', v: 'Completed count + 1. A visit_number N promo fires when next visit = N.' });
  summary.addRow({ k: 'General', v: 'tele + appointment + Pay Bill in that category (ecommerce excluded).' });

  const cust = wb.addWorksheet('Customers');
  const custCols = [
    { header: 'Customer ID', key: 'id', width: 38 },
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Phone', key: 'phone', width: 14 },
    { header: 'Pay Bill (all)', key: 'pb', width: 12 },
    { header: 'Tele (all)', key: 'tele', width: 10 },
    { header: 'Appointment (all)', key: 'appt', width: 14 },
    { header: 'Next visit platform (general)', key: 'nextF', width: 16 },
  ];
  for (const c of usedCats) {
    custCols.push(
      { header: `${c.name} · Pay Bill`, key: `${c.id}_pb`, width: 14 },
      { header: `${c.name} · Tele`, key: `${c.id}_tele`, width: 12 },
      { header: `${c.name} · Appointment`, key: `${c.id}_appt`, width: 14 },
      { header: `${c.name} · next visit (general)`, key: `${c.id}_ng`, width: 16 },
      { header: `${c.name} · next visit (Pay Bill only)`, key: `${c.id}_np`, width: 18 }
    );
  }
  cust.columns = custCols;
  for (const [userId, p] of profiles) {
    const who = people.get(userId) || { name: '', phone: '' };
    const row = {
      id: userId,
      name: who.name,
      phone: who.phone,
      pb: p.platform.paybill.count,
      tele: p.platform.tele.count,
      appt: p.platform.appointment.count,
      nextF: GENERAL.reduce((s, ch) => s + p.platform[ch].count, 0) + 1,
    };
    for (const c of usedCats) {
      const cells = p.categories[c.id];
      if (!cells) continue;
      row[`${c.id}_pb`] = cells.paybill.count;
      row[`${c.id}_tele`] = cells.tele.count;
      row[`${c.id}_appt`] = cells.appointment.count;
      row[`${c.id}_ng`] = GENERAL.reduce((s, ch) => s + cells[ch].count, 0) + 1;
      row[`${c.id}_np`] = cells.paybill.count + 1;
    }
    cust.addRow(row);
  }

  const vend = wb.addWorksheet('Vendor visits');
  vend.columns = [
    { header: 'Customer ID', key: 'id', width: 38 },
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Phone', key: 'phone', width: 14 },
    { header: 'Vendor ID', key: 'vid', width: 38 },
    { header: 'Vendor', key: 'vendor', width: 32 },
    { header: 'Category', key: 'cat', width: 22 },
    { header: 'Pay Bill', key: 'pb', width: 10 },
    { header: 'Tele', key: 'tele', width: 8 },
    { header: 'Appointment', key: 'appt', width: 12 },
    { header: 'Next visit at vendor (general)', key: 'next', width: 16 },
  ];
  for (const [userId, p] of profiles) {
    const who = people.get(userId) || { name: '', phone: '' };
    for (const [vendorId, cells] of Object.entries(p.vendors)) {
      vend.addRow({
        id: userId,
        name: who.name,
        phone: who.phone,
        vid: vendorId,
        vendor: vendorNames.get(vendorId) || '',
        cat: names.get(cells.categoryId) || '',
        pb: cells.paybill.count,
        tele: cells.tele.count,
        appt: cells.appointment.count,
        next: GENERAL.reduce((s, ch) => s + cells[ch].count, 0) + 1,
      });
    }
  }

  const tx = wb.addWorksheet('Transactions');
  tx.columns = [
    { header: 'Source', key: 'source', width: 10 },
    { header: 'Reference ID', key: 'ref', width: 38 },
    { header: 'Date (IST)', key: 'at', width: 17 },
    { header: 'Customer ID', key: 'id', width: 38 },
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Phone', key: 'phone', width: 14 },
    { header: 'Vendor', key: 'vendor', width: 32 },
    { header: 'Vendor role', key: 'role', width: 18 },
    { header: 'Vendor deleted', key: 'deleted', width: 10 },
    { header: 'Booking style', key: 'style', width: 14 },
    { header: 'Channel', key: 'channel', width: 12 },
    { header: 'Category', key: 'cat', width: 22 },
    { header: 'Amount', key: 'amount', width: 10 },
    { header: 'Status', key: 'status', width: 16 },
  ];
  for (const v of candidates) {
    tx.addRow({
      source: v.source,
      ref: v.referenceId,
      at: v.atIst,
      id: v.userId,
      name: v.customerName,
      phone: phone10(v.customerPhone),
      vendor: v.vendorName,
      role: v.roleName || '',
      deleted: v.vendorDeleted ? 'yes' : '',
      style: v.style || '',
      channel: v.channel,
      cat: v.categoryId ? names.get(v.categoryId) || v.categoryId : '(none)',
      amount: v.amount,
      status: existing.has(`${v.userId}|${v.referenceId}`) ? 'already recorded' : APPLY ? 'recorded now' : 'to record',
    });
  }
  for (const ws of [cust, vend, tx]) {
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const mode = APPLY ? 'apply' : PREVIEW_ROLE_MAP ? 'preview' : 'dryrun';
  const file = path.join(OUT_DIR, `vcf-backfill-${ENVIRONMENT}-${mode}-${stamp}.xlsx`);
  await wb.xlsx.writeFile(file);
  return file;
}

function countBy(list, fn) {
  const out = {};
  for (const x of list) {
    const k = fn(x);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

async function runVerify() {
  const { usersChecked, mismatches } = await compareStoredWithEvents();
  console.log(JSON.stringify({ environment: ENVIRONMENT, mode: 'verify', usersChecked, mismatches: mismatches.length, samples: mismatches.slice(0, 20) }, null, 2));
  if (mismatches.length) process.exitCode = 2;
}

async function main() {
  if (VERIFY) return runVerify();
  if (APPLY && PREVIEW_ROLE_MAP) throw new Error('--preview-role-map is for dry runs only; run migration 1121 instead');
  if (APPLY && ENVIRONMENT === 'prod' && !CONFIRM_PROD) throw new Error('Refusing prod writes without --confirm-prod');

  const eventsExist = await tableExists('customer_behaviour_events');
  const profilesExist = await tableExists('customer_behaviour_profiles');
  if (APPLY && (!eventsExist || !profilesExist)) {
    throw new Error('Run migration 1112 first (customer_behaviour_events / customer_behaviour_profiles missing)');
  }

  let catalogue = await loadCatalogue();
  if (PREVIEW_ROLE_MAP) catalogue = applyMigrationRoleMap(catalogue);
  const mappedCategories = catalogue.filter((c) => c.roles.length).length;
  if (APPLY && !mappedCategories) throw new Error('Refusing to apply with an empty role → category mapping (run 1121)');

  const { candidates, skipped, pays, bookings } = await loadCandidates(catalogue);
  const existing = await loadExistingVisitKeys(eventsExist);
  const missing = candidates.filter((v) => !existing.has(`${v.userId}|${v.referenceId}`));

  const names = new Map(catalogue.map((c) => [c.id, c.name]));
  const meta = {
    environment: ENVIRONMENT,
    mode: APPLY ? 'apply' : PREVIEW_ROLE_MAP ? 'dry-run (role map from migration 1121 applied in memory)' : 'dry-run',
    generatedAt: new Date().toISOString(),
    categoriesWithRoles: mappedCategories,
    payBillsCompleted: pays,
    bookingsCompleted: bookings,
    bookingsNotAVisitStyle: skipped.booking_not_visit_channel,
    visitsFound: candidates.length,
    alreadyRecorded: candidates.length - missing.length,
    toRecord: missing.length,
    byChannel: countBy(candidates, (v) => v.channel),
    byCategory: countBy(candidates, (v) => (v.categoryId ? names.get(v.categoryId) : '(none)')),
    noCategoryReason: countBy(
      candidates.filter((v) => !v.categoryId),
      (v) => (v.vendorDeleted ? 'vendor deleted' : !v.roleName ? 'vendor has no role' : `role not mapped: ${v.roleName}`)
    ),
  };

  if (!APPLY) {
    const projected = buildProfiles(eventsExist ? [...(await loadEffectiveVisits()), ...missing] : candidates);
    meta.customers = projected.size;
    const file = await writeReport({ candidates, existing, profiles: projected, catalogue, meta });
    console.log(JSON.stringify({ ...meta, report: file }, null, 2));
    if (!mappedCategories) console.warn('WARNING: no vendor_roles mapping — categories are empty. Use --preview-role-map or run 1121.');
    return;
  }

  await insertEvents(missing);
  const profiles = buildProfiles(await loadEffectiveVisits());
  await upsertProfiles(profiles);
  const check = await compareStoredWithEvents();
  meta.customers = profiles.size;
  meta.insertedEvents = missing.length;
  meta.profilesWritten = profiles.size;
  meta.postWriteMismatches = check.mismatches.length;
  const file = await writeReport({ candidates, existing, profiles, catalogue, meta });
  console.log(JSON.stringify({ ...meta, report: file, mismatchSamples: check.mismatches.slice(0, 20) }, null, 2));
  if (check.mismatches.length) {
    throw new Error(`Post-write check failed: ${check.mismatches.length} cells differ from the event log`);
  }
}

module.exports = { loadCatalogue, loadCandidates, buildProfiles, applyMigrationRoleMap, GENERAL, COUNT_CHANNELS };

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
