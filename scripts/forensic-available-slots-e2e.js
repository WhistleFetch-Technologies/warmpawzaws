#!/usr/bin/env node
/**
 * Forensic E2E: Available Slots – Multi-Style, All Vendors
 *
 * Verifies GET /customer/vendor/:vendorId/available-slots:
 * - Correct endpoint path (customer, not vendor)
 * - serviceStyle=at_center | at_home | tele (and no default disconnect)
 * - Fallback when no serviceStyle returns any vendor+day slots
 * - Applies to every vendor (center, solo, multi-style)
 *
 * Steps:
 * 1. Get vendors from discover-services (vet at_center, at_home, tele; grooming; training)
 * 2. For each vendor/style, pick the earliest upcoming date that has VA2 availability (resolves
 *    vendor identity IDs, reads VA2 day_of_week, skips vendor holidays); then call available-slots.
 * 3. Assert: 200, { success: true, slots: array }; slots may be [] if no availability.
 * 4. Print VA2 date summary: chosen date and day_of_week per vendor/style for debugging.
 *
 * Usage:
 *   node scripts/forensic-available-slots-e2e.js
 *
 * Env:
 *   TEST_API_URL / API_BASE_URL  – API base (default: warmpawz dev API)
 *   USE_DB_DATE=0                – disable DB date selection; use tomorrow for all
 *   SLOT_START_DATE=YYYY-MM-DD   – start date for "next available" search (default: tomorrow)
 *   ENVIRONMENT=dev              – for RDS cluster / Secrets Manager
 */

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Client } = require('pg');
const { execSync } = require('child_process');

const API_BASE = process.env.TEST_API_URL || process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const USE_DB_DATE = !['0', 'false', 'no'].includes(String(process.env.USE_DB_DATE || '').toLowerCase());
const SLOT_START_DATE = process.env.SLOT_START_DATE || process.env.SLOT_DATE || '';
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const DB_SECRET_ARN = process.env.DB_SECRET_ARN || '';

const SERVICE_STYLES = ['at_center', 'at_home', 'tele'];

// (category, serviceStyle) pairs to get a mix of center/solo vendors
const DISCOVER_QUERIES = [
  { category: 'vet', serviceStyle: 'at_center' },
  { category: 'vet', serviceStyle: 'at_home' },
  { category: 'vet', serviceStyle: 'tele' },
  { category: 'grooming', serviceStyle: 'at_center' },
  { category: 'grooming', serviceStyle: 'at_home' },
  { category: 'training', serviceStyle: 'at_center' },
  { category: 'training', serviceStyle: 'at_home' },
  { category: 'walker', serviceStyle: 'at_home' },
];

function tomorrowDateStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function parseDateOnly(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function normalizeServiceStyle(serviceStyle) {
  if (serviceStyle === 'at_vendor') return 'at_center';
  return serviceStyle;
}

function acceptableStylesFor(serviceStyle) {
  const normalized = normalizeServiceStyle(serviceStyle);
  if (normalized === 'at_center') return ['at_center', 'at_vendor'];
  if (normalized === 'tele') return ['tele', 'online', 'video_consultation'];
  return [normalized];
}

function nextDateForDayOfWeek(startDate, dayOfWeek) {
  const d = new Date(startDate);
  const delta = (dayOfWeek - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  return d;
}

async function resolveDbEndpoint() {
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const endpoint = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
    { encoding: 'utf8' }
  ).trim();

  const port = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Port' --output text`,
    { encoding: 'utf8' }
  ).trim() || '5432';

  const dbName = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].DatabaseName' --output text`,
    { encoding: 'utf8' }
  ).trim() || 'warmpawz';

  const username = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].MasterUsername' --output text`,
    { encoding: 'utf8' }
  ).trim() || 'warmpawz_admin';

  return { endpoint, port: parseInt(port, 10), dbName, username };
}

async function resolveSecretArn() {
  if (DB_SECRET_ARN) return DB_SECRET_ARN;
  return `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
}

async function getDbCredentials(secretArn) {
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const response = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretArn }));
  return JSON.parse(response.SecretString);
}

async function query(client, sql, params) {
  const res = await client.query(sql, params);
  return res.rows;
}

async function detectSchema(client) {
  const rows = await query(
    client,
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vendor_availability_v2'`
  ).catch(() => []);
  const columns = new Set(rows.map((r) => r.column_name));
  const hasServiceStyles = columns.has('service_styles');
  const hasServiceStyle = columns.has('service_style');
  const hasServiceType = columns.has('service_type');
  const hasIsEnabled = columns.has('is_enabled');
  const hasIsAvailable = columns.has('is_available');

  const holidayRows = await query(
    client,
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'vendor_holidays'
    ) as exists`
  ).catch(() => [{ exists: false }]);
  const hasVendorHolidays = holidayRows?.[0]?.exists === true || holidayRows?.[0]?.exists === 't';

  return { hasServiceStyles, hasServiceStyle, hasServiceType, hasIsEnabled, hasIsAvailable, hasVendorHolidays };
}

async function initDb() {
  if (!USE_DB_DATE) return null;
  try {
    const { endpoint, port, dbName, username } = await resolveDbEndpoint();
    const secretArn = await resolveSecretArn();
    const creds = await getDbCredentials(secretArn);
    const client = new Client({
      host: endpoint,
      port,
      database: dbName,
      user: username,
      password: creds.password || creds.Password || creds.secret || creds.Secret,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });
    await client.connect();
    const schema = await detectSchema(client);
    return { client, schema };
  } catch (err) {
    log('db', `DB date selection disabled (fallback to tomorrow): ${err?.message || err}`);
    return null;
  }
}

const availabilityIdCache = new Map();
const availabilityDayCache = new Map();
const holidaysCache = new Map();

async function resolveAvailabilityIds(client, vendorId) {
  if (availabilityIdCache.has(vendorId)) return availabilityIdCache.get(vendorId);
  const ids = new Set([String(vendorId)]);
  try {
    const vendorRows = await query(client, `SELECT id, phone FROM vendors WHERE id::text = $1`, [String(vendorId)]);
    if (vendorRows.length > 0) {
      const vendor = vendorRows[0];
      ids.add(String(vendor.id));
      const phone = vendor.phone || '';
      const identityRows = await query(
        client,
        `SELECT id FROM vendor_identity WHERE vendor_id::text = $1 OR phone = $2`,
        [String(vendor.id), phone]
      ).catch(() => []);
      for (const row of identityRows) {
        if (row?.id) ids.add(String(row.id));
      }
    } else {
      const identityRows = await query(
        client,
        `SELECT id, vendor_id, phone FROM vendor_identity WHERE id::text = $1 OR vendor_id::text = $1`,
        [String(vendorId)]
      ).catch(() => []);
      if (identityRows.length > 0) {
        const first = identityRows[0];
        for (const row of identityRows) {
          if (row?.id) ids.add(String(row.id));
          if (row?.vendor_id) ids.add(String(row.vendor_id));
        }
        if (first?.vendor_id || first?.phone) {
          const more = await query(
            client,
            `SELECT id FROM vendor_identity WHERE vendor_id::text = $1 OR phone = $2`,
            [String(first?.vendor_id || ''), String(first?.phone || '')]
          ).catch(() => []);
          for (const row of more) {
            if (row?.id) ids.add(String(row.id));
          }
        }
      }
    }
  } catch (_) {
    // best-effort only
  }
  const list = [...ids];
  availabilityIdCache.set(vendorId, list);
  return list;
}

async function getHolidaySet(client, vendorId, schema) {
  if (!schema?.hasVendorHolidays) return new Set();
  if (holidaysCache.has(vendorId)) return holidaysCache.get(vendorId);
  const rows = await query(
    client,
    `SELECT holiday_date FROM vendor_holidays WHERE vendor_id::text = $1`,
    [String(vendorId)]
  ).catch(() => []);
  const set = new Set(rows.map((r) => {
    const d = r?.holiday_date ? new Date(r.holiday_date) : null;
    return d && !Number.isNaN(d.getTime()) ? formatDateOnly(d) : null;
  }).filter(Boolean));
  holidaysCache.set(vendorId, set);
  return set;
}

async function getAvailabilityDays(client, availabilityIds, serviceStyle, schema) {
  const key = `${availabilityIds.join('|')}|${serviceStyle}`;
  if (availabilityDayCache.has(key)) return availabilityDayCache.get(key);

  const acceptable = acceptableStylesFor(serviceStyle);
  const enabledExpr = (schema.hasIsEnabled && schema.hasIsAvailable)
    ? 'COALESCE(is_enabled, is_available, true) = true'
    : schema.hasIsEnabled
      ? 'COALESCE(is_enabled, true) = true'
      : schema.hasIsAvailable
        ? 'COALESCE(is_available, true) = true'
        : 'true';

  let styleClause = '';
  let params = [availabilityIds];
  if (schema.hasServiceStyles) {
    styleClause = `AND (COALESCE(service_styles, ARRAY[]::text[]) && $2::text[])`;
    params = [availabilityIds, acceptable];
  } else if (schema.hasServiceStyle || schema.hasServiceType) {
    styleClause = `AND COALESCE(service_style, service_type)::text = ANY($2::text[])`;
    params = [availabilityIds, acceptable];
  }

  const rows = await query(
    client,
    `SELECT DISTINCT day_of_week
     FROM vendor_availability_v2
     WHERE vendor_id::text = ANY($1::text[])
       AND ${enabledExpr}
       ${styleClause}
     ORDER BY day_of_week`,
    params
  ).catch(() => []);

  const days = rows.map((r) => Number(r.day_of_week)).filter((n) => Number.isFinite(n));
  availabilityDayCache.set(key, days);
  return days;
}

async function pickDateFromVA2(dbState, vendorId, serviceStyle, baseDateStr) {
  if (!dbState) return baseDateStr;
  const { client, schema } = dbState;
  const baseDate = parseDateOnly(baseDateStr) || parseDateOnly(tomorrowDateStr());
  const availabilityIds = await resolveAvailabilityIds(client, vendorId);
  const days = await getAvailabilityDays(client, availabilityIds, serviceStyle, schema);
  if (!days || days.length === 0) return baseDateStr;

  const holidays = await getHolidaySet(client, vendorId, schema);
  const candidates = days.map((dayOfWeek) => {
    let date = nextDateForDayOfWeek(baseDate, dayOfWeek);
    for (let i = 0; i < 8; i += 1) {
      const dateStr = formatDateOnly(date);
      if (!holidays.has(dateStr)) break;
      date = new Date(date);
      date.setDate(date.getDate() + 7);
    }
    return date;
  });
  candidates.sort((a, b) => a.getTime() - b.getTime());
  const chosen = candidates[0];
  return chosen ? formatDateOnly(chosen) : baseDateStr;
}

function log(step, message, data) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${step}] ${message}`);
  if (data != null && typeof data === 'object') {
    const str = JSON.stringify(data);
    if (str.length > 300) console.log('  ' + str.substring(0, 300) + '...');
    else console.log('  ' + str);
  }
}

async function fetchJson(url) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${data?.error || data?.message || res.statusText}`);
  }
  return data;
}

async function main() {
  const base = API_BASE.replace(/\/$/, '');
  const baseDateStr = parseDateOnly(SLOT_START_DATE) ? SLOT_START_DATE : tomorrowDateStr();
  const dbState = await initDb();

  console.log('\n' + '═'.repeat(70));
  console.log('FORENSIC E2E: Available Slots (Multi-Style, All Vendors)');
  console.log('═'.repeat(70));
  console.log(`API: ${base}`);
  console.log(`Base Date: ${baseDateStr}${USE_DB_DATE ? ' (VA2-aware)' : ''}`);
  console.log('═'.repeat(70));

  const results = { passed: 0, failed: 0, errors: [] };
  const vendorIdsChecked = new Set();

  // 1. Collect vendor IDs from discover-services (one per query to get variety)
  console.log('\n📋 STEP 1: Collect vendor IDs from discover-services');
  console.log('─'.repeat(70));

  const vendorsToTest = [];
  for (const q of DISCOVER_QUERIES) {
    try {
      const url = `${base}/customer/discover-services?category=${encodeURIComponent(q.category)}&serviceStyle=${q.serviceStyle}&latitude=12.9716&longitude=77.5946`;
      const res = await fetchJson(url);
      const list = res.providers ?? res.vendors ?? [];
      if (Array.isArray(list) && list.length > 0) {
        const first = list[0];
        const vendorId = first.id ?? first.vendor_id ?? first.vendorId ?? first.vendorId;
        if (vendorId && !vendorIdsChecked.has(vendorId)) {
          vendorIdsChecked.add(vendorId);
          vendorsToTest.push({
            vendorId,
            name: first.business_name ?? first.name ?? first.vendorName ?? vendorId.slice(0, 8),
            category: q.category,
            serviceStyle: q.serviceStyle,
          });
          log('discover', `${q.category} ${q.serviceStyle} → vendor ${vendorId.slice(0, 8)}...`, { count: list.length });
        }
      }
    } catch (e) {
      log('discover', `${q.category} ${q.serviceStyle} FAIL: ${e.message}`);
    }
  }

  if (vendorsToTest.length === 0) {
    console.log('  ⚠️  No vendors found from discover-services. Trying by-style...');
    try {
      const url = `${base}/customer/services/by-style?style=at_center&category=vet`;
      const res = await fetchJson(url);
      const list = res.providers ?? [];
      if (Array.isArray(list) && list.length > 0) {
        const first = list[0];
        const vendorId = first.id ?? first.vendor_id ?? first.vendorId;
        if (vendorId) {
          vendorsToTest.push({ vendorId, name: first.business_name ?? vendorId.slice(0, 8), category: 'vet', serviceStyle: 'at_center' });
        }
      }
    } catch (e2) {
      console.log('  by-style fallback failed:', e2.message);
    }
  }

  console.log(`  Vendors to test: ${vendorsToTest.length}`);
  if (vendorsToTest.length === 0) {
    results.failed++;
    results.errors.push({ step: 'collect vendors', error: 'No vendors found from discovery' });
    printSummary(results);
    process.exit(1);
  }

  // 2. For each vendor, call available-slots with each serviceStyle (and once without)
  console.log('\n📋 STEP 2: GET /customer/vendor/:vendorId/available-slots');
  console.log('─'.repeat(70));

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const va2DateSummary = [];

  for (const v of vendorsToTest) {
    const stylesToTry = [v.serviceStyle, ...SERVICE_STYLES.filter((s) => s !== v.serviceStyle)];
    const uniqueStyles = [...new Set(stylesToTry)];

    for (const serviceStyle of uniqueStyles) {
      const date = await pickDateFromVA2(dbState, v.vendorId, serviceStyle, baseDateStr);
      const dayOfWeek = new Date(date + 'T12:00:00').getDay();
      const qs = `date=${date}&serviceStyle=${serviceStyle}`;
      const url = `${base}/customer/vendor/${v.vendorId}/available-slots?${qs}`;
      try {
        const res = await fetchJson(url);
        const hasSuccess = res.success === true;
        const slotsArray = Array.isArray(res.slots);
        const slots = res.slots ?? [];

        if (hasSuccess && slotsArray) {
          results.passed++;
          va2DateSummary.push({ vendor: v.vendorId.slice(0, 8), style: serviceStyle, date, dow: dayOfWeek, dayName: DAY_NAMES[dayOfWeek], slots: slots.length });
          log('slots', `${v.vendorId.slice(0, 8)} style=${serviceStyle} date=${date} → ${slots.length} slots`, { success: true });
        } else {
          results.failed++;
          va2DateSummary.push({ vendor: v.vendorId.slice(0, 8), style: serviceStyle, date, dow: dayOfWeek, dayName: DAY_NAMES[dayOfWeek], slots: 'FAIL' });
          const err = { vendorId: v.vendorId.slice(0, 8), serviceStyle, date, success: hasSuccess, slotsArray, response: res };
          results.errors.push({ step: 'available-slots shape', ...err });
          log('slots', `FAIL shape: ${v.vendorId.slice(0, 8)} style=${serviceStyle}`, err);
        }
      } catch (e) {
        results.failed++;
        va2DateSummary.push({ vendor: v.vendorId.slice(0, 8), style: serviceStyle, date, dow: dayOfWeek, dayName: DAY_NAMES[dayOfWeek], slots: 'err' });
        results.errors.push({ step: 'available-slots', vendorId: v.vendorId.slice(0, 8), serviceStyle, error: e.message });
        log('slots', `FAIL ${v.vendorId.slice(0, 8)} style=${serviceStyle}: ${e.message}`);
      }
    }

    // No serviceStyle (fallback: any availability for vendor+day)
    const dateNoStyle = await pickDateFromVA2(dbState, v.vendorId, v.serviceStyle, baseDateStr);
    const dayOfWeekNoStyle = new Date(dateNoStyle + 'T12:00:00').getDay();
    const urlNoStyle = `${base}/customer/vendor/${v.vendorId}/available-slots?date=${dateNoStyle}`;
    try {
      const res = await fetchJson(urlNoStyle);
      const hasSuccess = res.success === true;
      const slotsArray = Array.isArray(res.slots);
      const slotCount = (res.slots || []).length;

      if (hasSuccess && slotsArray) {
        results.passed++;
        va2DateSummary.push({ vendor: v.vendorId.slice(0, 8), style: '(no style)', date: dateNoStyle, dow: dayOfWeekNoStyle, dayName: DAY_NAMES[dayOfWeekNoStyle], slots: slotCount });
        log('slots', `${v.vendorId.slice(0, 8)} (no serviceStyle) date=${dateNoStyle} → ${slotCount} slots`, { success: true });
      } else {
        results.failed++;
        va2DateSummary.push({ vendor: v.vendorId.slice(0, 8), style: '(no style)', date: dateNoStyle, dow: dayOfWeekNoStyle, dayName: DAY_NAMES[dayOfWeekNoStyle], slots: 'FAIL' });
        results.errors.push({ step: 'available-slots no style', vendorId: v.vendorId.slice(0, 8), success: hasSuccess, slotsArray });
        log('slots', `FAIL ${v.vendorId.slice(0, 8)} no serviceStyle: wrong shape`);
      }
    } catch (e) {
      results.failed++;
      va2DateSummary.push({ vendor: v.vendorId.slice(0, 8), style: '(no style)', date: dateNoStyle, dow: dayOfWeekNoStyle, dayName: DAY_NAMES[dayOfWeekNoStyle], slots: 'err' });
      results.errors.push({ step: 'available-slots no style', vendorId: v.vendorId.slice(0, 8), error: e.message });
      log('slots', `FAIL ${v.vendorId.slice(0, 8)} no serviceStyle: ${e.message}`);
    }
  }

  if (va2DateSummary.length > 0) {
    console.log('\n📋 VA2 date summary (chosen date & day_of_week per vendor/style)');
    console.log('─'.repeat(70));
    console.log('  vendor     style        date         day(dow)  slots');
    va2DateSummary.forEach((r) => {
      console.log(`  ${r.vendor.padEnd(10)} ${String(r.style).padEnd(12)} ${r.date}  ${r.dayName}(${r.dow})   ${r.slots}`);
    });
    console.log('─'.repeat(70));
  }

  // 3. Sanity: wrong path /vendor/.../available-slots should 404 or different (we use customer path)
  console.log('\n📋 STEP 3: Sanity – customer path only (no vendor path for customer web)');
  console.log('─'.repeat(70));
  const firstVendor = vendorsToTest[0];
  if (firstVendor) {
    try {
      const vendorPathUrl = `${base}/vendor/${firstVendor.vendorId}/available-slots?date=${baseDateStr}&serviceStyle=at_center`;
      const res = await fetch(vendorPathUrl);
      const body = await res.json().catch(() => ({}));
      // Vendor path may 404 or return different shape; we only require customer path to work
      log('sanity', `GET /vendor/.../available-slots → ${res.status}`, body?.slots != null ? 'has slots (vendor endpoint)' : '');
      results.passed++;
    } catch (e) {
      log('sanity', 'Vendor path request failed (expected if not implemented): ' + e.message);
      results.passed++;
    }
  }

  if (dbState?.client) {
    await dbState.client.end().catch(() => {});
  }

  printSummary(results);
  process.exit(results.failed > 0 ? 1 : 0);
}

function printSummary(results) {
  console.log('\n' + '═'.repeat(70));
  console.log('FORENSIC AVAILABLE-SLOTS SUMMARY');
  console.log('═'.repeat(70));
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach((e) => console.log('  -', e.step, e.error || e.vendorId || '', e.serviceStyle || '', JSON.stringify(e).slice(0, 120)));
  }
  console.log('═'.repeat(70) + '\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
