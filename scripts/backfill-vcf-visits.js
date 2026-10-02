/**
 * Backfill promo-engine V/C/F visit counts from historical transactions (dev or prod).
 *
 * Mirrors the live writer (backend/lambda/src/discount-engine/promo-engine/services/visit-writer.service.ts):
 *   - Pay Bill: payments.payment_source='warmpawz_pay', completed, referenceId = payments.id, channel 'paybill'
 *   - Bookings: status='completed', channel from service_style || service_type (tele / appointment),
 *     referenceId = bookings.id
 *   - Category: metadata/booking category if it is a real service_categories.id, else the first
 *     catalogue row whose vendor_roles lists the vendor's role id or name (same order as runtime).
 *
 * Step 1 inserts one VCF_VISIT event per transaction that has none (idempotent by referenceId).
 * Step 2 rebuilds services.vcf for every user from VCF_VISIT minus VCF_VISIT_REVERSE events, so the
 * profile always equals the event log. Other keys under services are preserved. Safe to re-run.
 *
 * Usage (dry run is the default and writes nothing):
 *   $env:ENVIRONMENT='prod'; $env:AWS_PROFILE='cursor-agent'; node scripts/backfill-vcf-visits.js
 *   ... node scripts/backfill-vcf-visits.js --apply --confirm-prod
 */
const { query, executeSQL, ENVIRONMENT } = require('./rds-data-api-utils-dev');

const APPLY = process.argv.includes('--apply');
const CONFIRM_PROD = process.argv.includes('--confirm-prod');
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
    SELECT id::text AS id, vendor_roles::text AS vendor_roles, name
    FROM service_categories
    ORDER BY COALESCE(is_active, true) DESC, display_order ASC NULLS LAST, id`);
  return rows.map((r) => ({ id: r.id, name: r.name, roles: rolesOnCategory(r.vendor_roles) }));
}

async function loadCandidates(catalogue) {
  const catalogueIds = new Set(catalogue.map((c) => c.id));
  const pays = await query(`
    SELECT p.id::text AS id, p.customer_id::text AS customer_id, p.vendor_id::text AS vendor_id,
           p.completed_at::text AS at,
           COALESCE(p.metadata->>'categoryId', p.metadata->>'bookingCategoryId') AS explicit_category,
           CASE WHEN v.is_deleted IS NOT TRUE THEN v.role_id::text END AS role_id,
           CASE WHEN v.is_deleted IS NOT TRUE THEN r.name END AS role_name
    FROM payments p
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
           COALESCE(NULLIF(b.service_style, ''), b.service_type) AS style,
           b.service_category::text AS explicit_category,
           CASE WHEN v.is_deleted IS NOT TRUE THEN v.role_id::text END AS role_id,
           CASE WHEN v.is_deleted IS NOT TRUE THEN r.name END AS role_name
    FROM bookings b
    LEFT JOIN vendors v ON v.id = b.vendor_id
    LEFT JOIN roles r ON r.id = v.role_id
    WHERE b.status = 'completed'
      AND b.customer_id IS NOT NULL
    ORDER BY 4 ASC`);

  const out = [];
  const skipped = { booking_not_visit_channel: 0 };
  for (const p of pays) {
    out.push({
      userId: p.customer_id,
      referenceId: p.id,
      channel: 'paybill',
      vendorId: p.vendor_id || null,
      categoryId: resolveCategory(p.explicit_category, p.role_id, p.role_name, catalogue, catalogueIds),
      roleId: p.role_id || null,
      roleName: p.role_name || null,
      at: p.at,
    });
  }
  for (const b of bookings) {
    const channel = bookingChannel(b.style);
    if (!channel) {
      skipped.booking_not_visit_channel += 1;
      continue;
    }
    out.push({
      userId: b.customer_id,
      referenceId: b.id,
      channel,
      vendorId: b.vendor_id || null,
      categoryId: resolveCategory(b.explicit_category, b.role_id, b.role_name, catalogue, catalogueIds),
      roleId: b.role_id || null,
      roleName: b.role_name || null,
      at: b.at,
    });
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

function summarise(visits, catalogue) {
  const names = new Map(catalogue.map((c) => [c.id, c.name]));
  const byChannel = {};
  const byCategory = {};
  const unresolvedRoles = {};
  for (const v of visits) {
    byChannel[v.channel] = (byChannel[v.channel] || 0) + 1;
    const cat = v.categoryId ? names.get(v.categoryId) || v.categoryId : '(no category)';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
    if (!v.categoryId) {
      const k = v.roleName || '(no role)';
      unresolvedRoles[k] = (unresolvedRoles[k] || 0) + 1;
    }
  }
  return { byChannel, byCategory, unresolvedRoles };
}

function nextVisitDistribution(profiles, catalogue, channels) {
  const out = {};
  for (const c of catalogue) {
    const buckets = { next_1: 0, next_2: 0, next_3: 0, next_4: 0, next_5_plus: 0 };
    let any = false;
    for (const p of profiles.values()) {
      const cells = p.categories[c.id];
      if (!cells) continue;
      const n = channels.reduce((s, ch) => s + (cells[ch]?.count || 0), 0);
      if (!n) continue;
      any = true;
      const next = n + 1;
      if (next >= 5) buckets.next_5_plus += 1;
      else buckets[`next_${next}`] += 1;
    }
    if (any) out[c.name] = buckets;
  }
  return out;
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

async function main() {
  if (APPLY && ENVIRONMENT === 'prod' && !CONFIRM_PROD) {
    throw new Error('Refusing prod writes without --confirm-prod');
  }
  const eventsExist = await tableExists('customer_behaviour_events');
  const profilesExist = await tableExists('customer_behaviour_profiles');
  if (APPLY && (!eventsExist || !profilesExist)) {
    throw new Error('Run migration 1112 first (customer_behaviour_events / customer_behaviour_profiles missing)');
  }

  const catalogue = await loadCatalogue();
  const mappedCategories = catalogue.filter((c) => c.roles.length).length;
  const { candidates, skipped, pays, bookings } = await loadCandidates(catalogue);
  const existing = await loadExistingVisitKeys(eventsExist);
  const missing = candidates.filter((v) => !existing.has(`${v.userId}|${v.referenceId}`));

  const projectedVisits = eventsExist ? [...(await loadEffectiveVisits()), ...missing] : candidates;
  const projected = buildProfiles(projectedVisits);

  console.log(
    JSON.stringify(
      {
        environment: ENVIRONMENT,
        mode: APPLY ? 'apply' : 'dry-run',
        catalogueRowsWithRoles: mappedCategories,
        source: { payBillsCompleted: pays, bookingsCompleted: bookings, ...skipped },
        alreadyRecorded: candidates.length - missing.length,
        toInsert: missing.length,
        toInsertSummary: summarise(missing, catalogue),
        profilesAfter: projected.size,
        nextVisitPayBillOnly: nextVisitDistribution(projected, catalogue, ['paybill']),
        nextVisitGeneral: nextVisitDistribution(projected, catalogue, GENERAL),
      },
      null,
      2
    )
  );

  if (!mappedCategories) {
    console.warn('WARNING: no service_categories.vendor_roles set — run migration 1121 before applying.');
  }
  if (!APPLY) return;
  if (!mappedCategories) throw new Error('Refusing to apply with an empty role → category mapping');

  await insertEvents(missing);
  const effective = await loadEffectiveVisits();
  const profiles = buildProfiles(effective);
  await upsertProfiles(profiles);
  console.log(JSON.stringify({ insertedEvents: missing.length, profilesWritten: profiles.size }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
