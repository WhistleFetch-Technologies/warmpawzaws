/**
 * DEV ONLY: seed the October Pay Bill visit ladder (fixed ₹ discount + fixed ₹ cashback) and the
 * ₹55 "fee covered" fallback into the promo engine, in the same shape POST /admin/promo-engine/promotions saves.
 * Pauses the dev promos that overlap the ladder. Idempotent: promos are matched by code and skipped if present.
 *
 *   ENVIRONMENT=dev AWS_PROFILE=cursor-agent node scripts/seed-promo-engine-paybill-ladder-dev.js [--dry-run]
 */
const { query } = require('./rds-data-api-utils-dev');

if ((process.env.ENVIRONMENT || 'dev') !== 'dev') {
  console.error('Refusing to run: this seed is for ENVIRONMENT=dev only.');
  process.exit(1);
}
const DRY_RUN = process.argv.includes('--dry-run');

const END_AT = '2026-10-31T18:29:00Z'; // Oct 31, 23:59 IST
const EXPIRY_DAYS = 30;
const PAYBILL = ['paybill'];

/** Promos on dev that compete with the ladder (platform-wide, priority 50, visit 1 / every 2nd). */
const PAUSE_IDS = [
  '267cf4b9-f461-4984-ae42-b29ea94b7704', // Platform New User
  'b740927f-6ac4-4962-bf6c-184a8f0857d7', // Promotion from 2nd second
];

const LADDER = [
  { code: 'PB-OCT26-V1', name: 'Pay Bill ladder - Visit 1', loop: { kind: 'visit_number', n: 1 }, priority: 50, discount: 225, cashback: 75, budget: 75000 },
  { code: 'PB-OCT26-V2', name: 'Pay Bill ladder - Visit 2', loop: { kind: 'visit_number', n: 2 }, priority: 50, discount: 150, cashback: 100, budget: 28000 },
  { code: 'PB-OCT26-V3', name: 'Pay Bill ladder - Visit 3', loop: { kind: 'visit_number', n: 3 }, priority: 50, discount: 125, cashback: 125, budget: 16000 },
  { code: 'PB-OCT26-V4', name: 'Pay Bill ladder - Visit 4 onward', loop: { kind: 'from_onward', n: 4 }, priority: 50, discount: 100, cashback: 75, budget: 11000 },
  { code: 'PB-OCT26-V5N', name: 'Pay Bill ladder - Every 5th visit', loop: { kind: 'every_nth', n: 5 }, priority: 60, discount: 100, cashback: 200, budget: 4000 },
  { code: 'PB-OCT26-FLOOR', name: 'Pay Bill - Fee covered fallback', loop: { kind: 'every' }, priority: 10, discount: 55, cashback: 0, budget: 33000 },
];

const lit = (v) => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const json = (v) => `${lit(JSON.stringify(v))}::jsonb`;

function buildPromo(p) {
  const hasCashback = p.cashback > 0;
  const vcf = {
    visitSource: { width: 'specific', letter: 'F', channels: PAYBILL, countMode: 'pooled' },
    visitLoop: p.loop,
    benefitMode: hasCashback ? 'both' : 'discount',
    maxDiscount: p.discount,
    publish: { letter: 'F', channels: PAYBILL },
    ...(hasCashback ? { redeem: { letter: 'F', channels: PAYBILL }, expiryDays: EXPIRY_DAYS } : {}),
  };
  const benefits = [{ type: 'DISCOUNT', mode: 'FIXED', value: p.discount, maxAmount: p.discount }];
  if (hasCashback) {
    benefits.push({ type: 'CASHBACK', mode: 'FIXED', value: p.cashback, expiryDays: EXPIRY_DAYS, redeemScope: [] });
  }
  return { vcf, benefits };
}

async function seedPromo(p) {
  const existing = await query(
    `SELECT id, status FROM promo_engine_promotions WHERE code = ${lit(p.code)} AND status <> 'ARCHIVED' LIMIT 1`
  );
  if (existing.length) {
    console.log(`SKIP ${p.code} already exists (${existing[0].id}, ${existing[0].status})`);
    return existing[0].id;
  }
  const { vcf, benefits } = buildPromo(p);
  if (DRY_RUN) {
    console.log(`DRY ${p.code} ${JSON.stringify({ priority: p.priority, vcf, benefits, budget: p.budget })}`);
    return null;
  }

  const [promo] = await query(`
    INSERT INTO promo_engine_promotions
      (name, code, status, priority, start_at, end_at, stacking_policy, funding_type,
       budget_limit, service_categories, metadata)
    VALUES (${lit(p.name)}, ${lit(p.code)}, 'ACTIVE', ${p.priority}, NOW(), ${lit(END_AT)}::timestamptz,
            'DISCOUNT_WITH_CASHBACK', 'WARMPAWZ', ${p.budget}, '{}'::text[], ${json({ vcf })})
    RETURNING id`);
  const id = promo.id;

  await query(`
    INSERT INTO promo_engine_rules (promotion_id, condition_json, benefit_json, rule_type, priority, is_active)
    VALUES (${lit(id)}::uuid, ${json({ operator: 'AND', conditions: [] })}, ${json(benefits)},
            'CUSTOMER_JOURNEY', 100, true)`);
  await query(`
    INSERT INTO promo_engine_limits (promotion_id, per_user, per_transaction, daily_limit, campaign_limit, budget_limit)
    VALUES (${lit(id)}::uuid, NULL, NULL, NULL, NULL, ${p.budget})`);
  await query(`
    INSERT INTO promo_engine_audit_log (promotion_id, event_type, payload)
    VALUES (${lit(id)}::uuid, 'STATUS_CHANGED', ${json({ to: 'ACTIVE', action: 'CREATE', source: 'seed-promo-engine-paybill-ladder-dev' })})`);
  console.log(`CREATED ${p.code} ${id}`);
  return id;
}

async function pauseConflicts() {
  for (const id of PAUSE_IDS) {
    const [row] = await query(`SELECT name, status FROM promo_engine_promotions WHERE id = ${lit(id)}::uuid`);
    if (!row) { console.log(`PAUSE-SKIP ${id} not found`); continue; }
    if (row.status !== 'ACTIVE') { console.log(`PAUSE-SKIP ${row.name} is ${row.status}`); continue; }
    if (DRY_RUN) { console.log(`DRY pause ${row.name}`); continue; }
    await query(`UPDATE promo_engine_promotions SET status = 'PAUSED', updated_at = NOW() WHERE id = ${lit(id)}::uuid`);
    await query(`
      INSERT INTO promo_engine_audit_log (promotion_id, event_type, payload)
      VALUES (${lit(id)}::uuid, 'STATUS_CHANGED', ${json({ to: 'PAUSED', reason: 'Overlaps the Pay Bill visit ladder', source: 'seed-promo-engine-paybill-ladder-dev' })})`);
    console.log(`PAUSED ${row.name} (${id})`);
  }
}

(async () => {
  try {
    await pauseConflicts();
    for (const p of LADDER) await seedPromo(p);
  } catch (e) {
    console.error('ERR ' + e.message);
    process.exit(1);
  }
})();
