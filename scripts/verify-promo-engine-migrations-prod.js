/**
 * READ-ONLY: verify promo-engine-v1 migrations on an environment and diff against the pre-cutover snapshot.
 * Expected: 1111-1117, 1119, 1120, 1121 applied. 1118 (at-home fee seed) is reported, not enforced.
 *
 *   $env:ENVIRONMENT='prod'; $env:AWS_PROFILE='cursor-agent'
 *   node scripts/verify-promo-engine-migrations-prod.js [prodscripts/snapshots/pre-promo-engine-2026-10-02.json]
 */
const fs = require('fs');
const path = require('path');
const { query } = require('./rds-data-api-utils-dev');

const SNAPSHOT =
  process.argv[2] || path.join(__dirname, '..', 'prodscripts', 'snapshots', 'pre-promo-engine-2026-10-02.json');

const EXPECT = {
  tables: {
    1111: ['promo_engine_promotions', 'promo_engine_rules', 'promo_engine_limits', 'promo_engine_usage'],
    1112: ['customer_behaviour_profiles', 'customer_behaviour_events'],
    1114: ['promo_engine_evaluations', 'promo_engine_audit_log'],
  },
  columns: {
    1113: ['wallet_transactions', ['promotion_id', 'source', 'remaining_amount', 'earned_at', 'expires_at', 'cashback_status', 'redeem_scope']],
    1115: ['customer_addresses', ['latitude', 'longitude']],
    1117: ['warmpawz_appointments_vendor_catalog', ['appointment_fee_home']],
    1119: ['promo_engine_usage', ['reversed_at']],
  },
  indexes: {
    1111: ['idx_promo_engine_promotions_status_window', 'idx_promo_engine_promotions_service_categories', 'idx_promo_engine_promotions_campaign',
      'idx_promo_engine_rules_promotion', 'idx_promo_engine_usage_idempotency', 'idx_promo_engine_usage_promo_user', 'idx_promo_engine_usage_transaction'],
    1112: ['idx_customer_behaviour_profiles_updated', 'idx_customer_behaviour_events_user'],
    1113: ['idx_wallet_transactions_promo_cashback', 'idx_wallet_transactions_promotion_id'],
    1114: ['idx_promo_engine_evaluations_user', 'idx_promo_engine_evaluations_expires', 'idx_promo_engine_audit_promo',
      'idx_promo_engine_audit_eval', 'idx_promo_engine_audit_event'],
    1119: ['idx_promo_engine_usage_live_promo'],
  },
};

const ROLE_MAP_1121 = {
  veterinary: ['vet_clinic', 'vet_solo'],
  grooming: ['groomer_center', 'groomer_solo'],
  walking: ['walker'],
  training: ['trainer_solo', 'trainer_center', 'behaviorist_solo', 'behaviorist_center'],
  boarding: ['boarding'],
  wellness: ['nutritionist_center', 'nutritionist'],
  'pet-sitting': ['sitter'],
  holiday: ['holiday'],
};

const results = [];
function check(migration, name, ok, detail) {
  results.push({ migration, check: name, status: ok ? 'PASS' : 'FAIL', detail: detail ?? '' });
}

function parseArr(s) {
  const t = String(s || '').trim();
  if (!t || t === '{}') return [];
  return t.replace(/^\{|\}$/g, '').split(',').map((x) => x.replace(/^"|"$/g, '').trim());
}

function byKey(rows, key) {
  return new Map(rows.map((r) => [r[key], r]));
}

async function main() {
  const tables = new Set((await query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`)).map((r) => r.table_name));
  for (const [m, list] of Object.entries(EXPECT.tables)) {
    for (const t of list) check(m, `table ${t}`, tables.has(t));
  }

  const cols = await query(`
    SELECT table_name, column_name, column_default, is_nullable
    FROM information_schema.columns WHERE table_schema='public'
      AND table_name IN ('wallet_transactions','customer_addresses','warmpawz_appointments_vendor_catalog','promo_engine_usage')`);
  const colSet = new Set(cols.map((c) => `${c.table_name}.${c.column_name}`));
  for (const [m, [t, list]] of Object.entries(EXPECT.columns)) {
    for (const c of list) check(m, `column ${t}.${c}`, colSet.has(`${t}.${c}`));
  }

  const idx = new Set((await query(`SELECT indexname FROM pg_indexes WHERE schemaname='public'`)).map((r) => r.indexname));
  for (const [m, list] of Object.entries(EXPECT.indexes)) {
    for (const i of list) check(m, `index ${i}`, idx.has(i));
  }

  const uq = await query(`SELECT indexdef FROM pg_indexes WHERE indexname='idx_promo_engine_usage_idempotency'`);
  check(1111, 'usage idempotency index is UNIQUE', /UNIQUE/i.test(uq[0]?.indexdef || ''), uq[0]?.indexdef);

  const promoChecks = await query(`
    SELECT conname FROM pg_constraint WHERE conrelid = 'promo_engine_promotions'::regclass AND contype IN ('c','f')`);
  check(1111, 'promo_engine_promotions constraints', promoChecks.length >= 3, promoChecks.map((r) => r.conname).join(', '));

  const counts = (await query(`
    SELECT (SELECT COUNT(*) FROM promo_engine_promotions)::int AS promotions,
           (SELECT COUNT(*) FROM promo_engine_usage)::int AS usage,
           (SELECT COUNT(*) FROM customer_behaviour_profiles)::int AS profiles,
           (SELECT COUNT(*) FROM customer_behaviour_events)::int AS events,
           (SELECT COUNT(*) FROM wallet_transactions WHERE source = 'PROMOTION')::int AS promo_cashback_rows`))[0];
  check('state', 'promo tables empty before seed/backfill', Object.values(counts).every((n) => Number(n) === 0), JSON.stringify(counts));

  const perm = await query(`
    SELECT COUNT(*)::int AS n, COUNT(DISTINCT role_id)::int AS roles
    FROM role_permissions WHERE permission_name = 'admin.warmpawz_pay.payments.settle'`);
  check(1116, 'settle permission rows', perm[0].n > 0, `${perm[0].n} rows across ${perm[0].roles} roles`);

  const feeCol = cols.find((c) => c.table_name === 'warmpawz_appointments_vendor_catalog' && c.column_name === 'appointment_fee_home');
  check(1117, 'appointment_fee_home default 0', /^0(\.0+)?(::numeric)?$/.test(String(feeCol?.column_default || '').replace(/[()]/g, '')), feeCol?.column_default);
  const feeChk = await query(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='wappt_catalog_fee_home_nonneg_chk'`);
  check(1117, 'CHECK wappt_catalog_fee_home_nonneg_chk', feeChk.length === 1, feeChk[0]?.def);

  const fees = await query(`
    SELECT id::text AS id, appointment_fee::text AS fee, appointment_fee_home::text AS home
    FROM warmpawz_appointments_vendor_catalog`);
  const homeNull = fees.filter((f) => f.home == null).length;
  const homeDiffers = fees.filter((f) => Number(f.home) !== Number(f.fee)).length;
  check(1117, 'home fee backfilled (no NULLs)', homeNull === 0, `${fees.length} rows, ${homeNull} NULL`);
  const seededPattern = fees.filter((f) => [999, 499, 99].includes(Number(f.home)) && Number(f.home) !== Number(f.fee)).length;
  check(1118, 'at-home fee seed (info only)', true,
    `${homeDiffers} rows where home ≠ centre, ${seededPattern} match the 999/499/99 seed`);

  const cats = await query(`SELECT category_id AS slug, name, vendor_roles::text AS roles FROM service_categories`);
  const petProducts = cats.find((c) => ['pet products', 'pet shop'].includes(String(c.name).trim().toLowerCase()));
  check(1120, 'Pet Products lists seller', parseArr(petProducts?.roles).includes('seller'), petProducts?.roles);
  for (const [slug, roles] of Object.entries(ROLE_MAP_1121)) {
    const row = cats.find((c) => c.slug === slug);
    const have = parseArr(row?.roles);
    const missing = roles.filter((r) => !have.includes(r));
    check(1121, `${slug} vendor_roles`, row && missing.length === 0, row ? `${row.roles}${missing.length ? ` missing ${missing}` : ''}` : 'slug not found');
  }

  const roleSpread = await query(`
    SELECT r.name AS role, COUNT(DISTINCT sc.id)::int AS categories
    FROM roles r JOIN service_categories sc ON r.name = ANY(sc.vendor_roles)
    GROUP BY r.name HAVING COUNT(DISTINCT sc.id) > 1`);
  check(1121, 'no role mapped to more than one category', roleSpread.length === 0, JSON.stringify(roleSpread));

  const unmapped = await query(`
    SELECT r.name AS role, COUNT(*)::int AS live_vendors
    FROM vendors v JOIN roles r ON r.id = v.role_id
    WHERE v.is_deleted IS NOT TRUE
      AND NOT EXISTS (SELECT 1 FROM service_categories sc WHERE r.name = ANY(sc.vendor_roles) OR r.id::text = ANY(sc.vendor_roles))
    GROUP BY r.name`);
  check(1121, 'every live vendor role resolves to a category', unmapped.length === 0, JSON.stringify(unmapped));

  if (fs.existsSync(SNAPSHOT)) {
    const snap = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')).tables;

    const settingsNow = await query(`
      SELECT setting_key, setting_value::text AS setting_value, is_active FROM admin_settings WHERE setting_category='wpay'`);
    const sNow = byKey(settingsNow, 'setting_key');
    const settingDiffs = snap.admin_settings_wpay.filter((s) => {
      const n = sNow.get(s.setting_key);
      return !n || n.setting_value !== s.setting_value || String(n.is_active) !== String(s.is_active);
    });
    check('snapshot', 'wpay admin_settings unchanged', settingDiffs.length === 0 && settingsNow.length === snap.admin_settings_wpay.length,
      settingDiffs.length ? JSON.stringify(settingDiffs) : `${settingsNow.length} keys identical`);

    const pricingNow = byKey(await query(`
      SELECT id::text AS id, discount_value::text AS discount_value, status, platform_withhold_percent::text AS platform_withhold_percent
      FROM warmpawz_pay_merchant_pricing`), 'id');
    const pricingDiffs = snap.warmpawz_pay_merchant_pricing.filter((p) => {
      const n = pricingNow.get(p.id);
      return !n || n.discount_value !== p.discount_value || n.status !== p.status || n.platform_withhold_percent !== p.platform_withhold_percent;
    });
    check('snapshot', 'merchant pricing unchanged', pricingDiffs.length === 0,
      pricingDiffs.length ? `${pricingDiffs.length} rows differ` : `${pricingNow.size} rows (snapshot ${snap.warmpawz_pay_merchant_pricing.length})`);

    const feeNow = byKey(fees, 'id');
    const feeDiffs = snap.warmpawz_appointments_vendor_catalog_fees.filter((f) => Number(feeNow.get(f.id)?.fee) !== Number(f.appointment_fee));
    check('snapshot', 'centre appointment fees unchanged (1118 guard)', feeDiffs.length === 0,
      feeDiffs.length ? `${feeDiffs.length} rows differ` : `${feeNow.size} rows (snapshot ${snap.warmpawz_appointments_vendor_catalog_fees.length})`);
  } else {
    check('snapshot', 'snapshot file present', false, SNAPSHOT);
  }

  const failed = results.filter((r) => r.status === 'FAIL');
  console.log('RESULT ' + JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 1));
  if (failed.length) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
