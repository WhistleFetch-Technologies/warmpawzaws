/**
 * Seed 15 ACTIVE grooming + veterinary Promotion Engine rules on DEV via RDS Data API.
 *
 * Usage (PowerShell):
 *   $env:ENVIRONMENT='dev'; node scripts/seed-dev-grooming-vet-promo-engine.js
 *   $env:ENVIRONMENT='dev'; node scripts/seed-dev-grooming-vet-promo-engine.js --apply --yes
 *   $env:ENVIRONMENT='dev'; node scripts/seed-dev-grooming-vet-promo-engine.js --test
 *
 * Idempotent on code (DEV_GV_*). Dev only.
 */
const { query, executeSQL } = require('./rds-data-api-utils-dev');

const ENVIRONMENT = (process.env.ENVIRONMENT || 'dev').toLowerCase();
const APPLY = process.argv.includes('--apply');
const YES = process.argv.includes('--yes');
const RUN_TEST = process.argv.includes('--test');
const DEV_API =
  process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const SEED_TAG = 'dev-grooming-vet-2026-09';

function sqlStr(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlJson(value) {
  return `${sqlStr(JSON.stringify(value))}::jsonb`;
}

function sqlTextArray(values) {
  return `ARRAY[${values.map(sqlStr).join(', ')}]::text[]`;
}

function andConditions(category, extra) {
  return {
    operator: 'AND',
    conditions: [
      { field: 'transaction.service_category', operator: '=', value: category },
      ...extra,
    ],
  };
}

function discountPercent(value, maxAmount) {
  return { type: 'DISCOUNT', mode: 'PERCENT', value, maxAmount };
}

function discountFixed(value) {
  return { type: 'DISCOUNT', mode: 'FIXED', value };
}

function cashbackFixed(value, redeemScope) {
  return {
    type: 'CASHBACK',
    mode: 'FIXED',
    value,
    expiryDays: 30,
    redeemScope,
  };
}

const PROMOS = [
  {
    code: 'DEV_GV_VET_FIRST',
    name: 'Vet first visit 15% + cashback',
    priority: 90,
    categories: ['veterinary'],
    stacking: 'DISCOUNT_WITH_CASHBACK',
    ruleType: 'CUSTOMER_JOURNEY',
    condition: andConditions('veterinary', [
      { field: 'user.veterinary_visit_count', operator: '=', value: 0 },
    ]),
    benefits: [discountPercent(15, 250), cashbackFixed(80, ['veterinary', 'grooming'])],
    limits: { per_user: 1, per_transaction: 1 },
  },
  {
    code: 'DEV_GV_VET_SECOND',
    name: 'Vet second visit ₹100 off',
    priority: 82,
    categories: ['veterinary'],
    stacking: 'NONE',
    ruleType: 'CUSTOMER_JOURNEY',
    condition: andConditions('veterinary', [
      { field: 'user.veterinary_visit_count', operator: '=', value: 1 },
    ]),
    benefits: [discountFixed(100)],
    limits: { per_user: 1, per_transaction: 1 },
  },
  {
    code: 'DEV_GV_VET_THIRD',
    name: 'Vet third visit 10% + ₹50 cashback',
    priority: 78,
    categories: ['veterinary'],
    stacking: 'DISCOUNT_WITH_CASHBACK',
    ruleType: 'CUSTOMER_JOURNEY',
    condition: andConditions('veterinary', [
      { field: 'user.veterinary_visit_count', operator: '=', value: 2 },
    ]),
    benefits: [discountPercent(10, 200), cashbackFixed(50, ['veterinary'])],
    limits: { per_user: 1, per_transaction: 1 },
  },
  {
    code: 'DEV_GV_VET_FIRST3',
    name: 'Vet first 3 visits 8% off',
    priority: 55,
    categories: ['veterinary'],
    stacking: 'NONE',
    ruleType: 'CUSTOMER_JOURNEY',
    condition: andConditions('veterinary', [
      { field: 'user.veterinary_visit_count', operator: 'BETWEEN', value: [0, 2] },
    ]),
    benefits: [discountPercent(8, 150)],
    limits: { per_user: 3, per_transaction: 1 },
  },
  {
    code: 'DEV_GV_VET_WINBACK',
    name: 'Vet winback 30 days 20% off',
    priority: 64,
    categories: ['veterinary'],
    stacking: 'NONE',
    ruleType: 'CUSTOMER_JOURNEY',
    condition: andConditions('veterinary', [
      { field: 'user.veterinary_visit_count', operator: '>=', value: 1 },
      { field: 'user.days_since_last_veterinary', operator: '>=', value: 30 },
    ]),
    benefits: [discountPercent(20, 400)],
    limits: { per_user: 1, per_transaction: 1 },
  },
  {
    code: 'DEV_GV_VET_WPAY_FIRST',
    name: 'Vet Pay Bill first visit 10% off',
    priority: 86,
    categories: ['veterinary'],
    stacking: 'NONE',
    ruleType: 'GENERIC',
    condition: andConditions('veterinary', [
      { field: 'transaction.type', operator: '=', value: 'WPAY' },
      { field: 'user.veterinary_visit_count', operator: '=', value: 0 },
    ]),
    benefits: [discountPercent(10, 200)],
    limits: { per_user: 1, per_transaction: 1 },
  },
  {
    code: 'DEV_GV_VET_TELE',
    name: 'Vet tele consult 12% off',
    priority: 74,
    categories: ['veterinary'],
    stacking: 'NONE',
    ruleType: 'GENERIC',
    condition: andConditions('veterinary', [
      { field: 'transaction.service_type', operator: '=', value: 'tele' },
    ]),
    benefits: [discountPercent(12, 180)],
    limits: { per_user: 5, per_transaction: 1 },
  },
  {
    code: 'DEV_GV_VET_MINBILL',
    name: 'Vet bill ₹1500+ 12% off',
    priority: 60,
    categories: ['veterinary'],
    stacking: 'NONE',
    ruleType: 'GENERIC',
    condition: andConditions('veterinary', [
      { field: 'transaction.amount', operator: '>=', value: 1500 },
    ]),
    benefits: [discountPercent(12, 300)],
    limits: { per_user: 10, per_transaction: 1 },
  },
  {
    code: 'DEV_GV_GROOM_FIRST',
    name: 'Grooming first visit 20% + cashback',
    priority: 91,
    categories: ['grooming'],
    stacking: 'DISCOUNT_WITH_CASHBACK',
    ruleType: 'CUSTOMER_JOURNEY',
    condition: andConditions('grooming', [
      { field: 'user.grooming_visit_count', operator: '=', value: 0 },
    ]),
    benefits: [discountPercent(20, 300), cashbackFixed(60, ['grooming', 'veterinary'])],
    limits: { per_user: 1, per_transaction: 1 },
  },
  {
    code: 'DEV_GV_GROOM_SECOND',
    name: 'Grooming second visit ₹150 off',
    priority: 81,
    categories: ['grooming'],
    stacking: 'NONE',
    ruleType: 'CUSTOMER_JOURNEY',
    condition: andConditions('grooming', [
      { field: 'user.grooming_visit_count', operator: '=', value: 1 },
    ]),
    benefits: [discountFixed(150)],
    limits: { per_user: 1, per_transaction: 1 },
  },
  {
    code: 'DEV_GV_GROOM_EVERY3',
    name: 'Grooming every 3rd visit 15% off',
    priority: 70,
    categories: ['grooming'],
    stacking: 'NONE',
    ruleType: 'CUSTOMER_JOURNEY',
    condition: andConditions('grooming', [
      {
        field: 'user.grooming_visit_count',
        operator: '%',
        value: { divisor: 3, remainder: 0, offset: 1 },
      },
    ]),
    benefits: [discountPercent(15, 200)],
    limits: { per_user: 12, per_transaction: 1 },
  },
  {
    code: 'DEV_GV_GROOM_LOYAL',
    name: 'Grooming 5+ visits 10% + ₹40 cashback',
    priority: 68,
    categories: ['grooming'],
    stacking: 'DISCOUNT_WITH_CASHBACK',
    ruleType: 'CUSTOMER_JOURNEY',
    condition: andConditions('grooming', [
      { field: 'user.grooming_visit_count', operator: '>=', value: 5 },
    ]),
    benefits: [discountPercent(10, 220), cashbackFixed(40, ['grooming'])],
    limits: { per_user: 6, per_transaction: 1 },
  },
  {
    code: 'DEV_GV_GROOM_WINBACK',
    name: 'Grooming winback 30 days 25% off',
    priority: 66,
    categories: ['grooming'],
    stacking: 'NONE',
    ruleType: 'CUSTOMER_JOURNEY',
    condition: andConditions('grooming', [
      { field: 'user.grooming_visit_count', operator: '>=', value: 1 },
      { field: 'user.days_since_last_grooming', operator: '>=', value: 30 },
    ]),
    benefits: [discountPercent(25, 350)],
    limits: { per_user: 1, per_transaction: 1 },
  },
  {
    code: 'DEV_GV_GROOM_WPAY',
    name: 'Grooming Pay Bill 8% off',
    priority: 84,
    categories: ['grooming'],
    stacking: 'NONE',
    ruleType: 'GENERIC',
    condition: andConditions('grooming', [
      { field: 'transaction.type', operator: '=', value: 'WPAY' },
    ]),
    benefits: [discountPercent(8, 160)],
    limits: { per_user: 8, per_transaction: 1 },
  },
  {
    code: 'DEV_GV_GROOM_CASHBACK',
    name: 'Grooming every visit ₹30 cashback',
    priority: 40,
    categories: ['grooming'],
    stacking: 'DISCOUNT_WITH_CASHBACK',
    ruleType: 'CUSTOMER_JOURNEY',
    condition: andConditions('grooming', [
      { field: 'user.grooming_visit_count', operator: '>=', value: 0 },
    ]),
    benefits: [cashbackFixed(30, ['grooming'])],
    limits: { per_user: 20, per_transaction: 1 },
  },
];

function requireDev() {
  if (ENVIRONMENT !== 'dev') {
    console.error('This seed is DEV only. Set ENVIRONMENT=dev');
    process.exit(1);
  }
  if (APPLY && !YES) {
    console.error('Refusing --apply without --yes');
    process.exit(1);
  }
}

async function listSeeded() {
  return query(`
    SELECT p.code, p.name, p.status, p.priority,
           p.service_categories::text AS service_categories,
           p.start_at::text AS start_at,
           p.end_at::text AS end_at,
           r.rule_type,
           COALESCE(jsonb_array_length(r.benefit_json), 0) AS benefit_count
    FROM promo_engine_promotions p
    LEFT JOIN promo_engine_rules r ON r.promotion_id = p.id
    WHERE p.code LIKE 'DEV_GV_%'
    ORDER BY p.priority DESC, p.code
  `);
}

async function upsertPromo(promo) {
  const rows = await query(`
    INSERT INTO promo_engine_promotions (
      code, name, status, priority, start_at, end_at,
      stacking_policy, funding_type, funding_split,
      service_categories, metadata, updated_at
    ) VALUES (
      ${sqlStr(promo.code)},
      ${sqlStr(promo.name)},
      'ACTIVE',
      ${Number(promo.priority)},
      NOW() - INTERVAL '1 hour',
      NOW() + INTERVAL '90 days',
      ${sqlStr(promo.stacking)},
      'WARMPAWZ',
      '{"warmpawz_percent":100,"vendor_percent":0}'::jsonb,
      ${sqlTextArray(promo.categories)},
      ${sqlJson({ seed: SEED_TAG, code: promo.code })},
      NOW()
    )
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      status = 'ACTIVE',
      priority = EXCLUDED.priority,
      start_at = EXCLUDED.start_at,
      end_at = EXCLUDED.end_at,
      stacking_policy = EXCLUDED.stacking_policy,
      funding_type = EXCLUDED.funding_type,
      funding_split = EXCLUDED.funding_split,
      service_categories = EXCLUDED.service_categories,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
    RETURNING id::text AS id, code
  `);
  const id = rows[0]?.id;
  if (!id) throw new Error(`No id returned for ${promo.code}`);

  await executeSQL(`DELETE FROM promo_engine_rules WHERE promotion_id = ${sqlStr(id)}::uuid`);
  await executeSQL(`
    INSERT INTO promo_engine_rules (
      promotion_id, priority, condition_json, benefit_json, rule_type, is_active
    ) VALUES (
      ${sqlStr(id)}::uuid,
      100,
      ${sqlJson(promo.condition)},
      ${sqlJson(promo.benefits)},
      ${sqlStr(promo.ruleType)},
      true
    )
  `);

  await executeSQL(`
    INSERT INTO promo_engine_limits (
      promotion_id, per_user, per_transaction, daily_limit, campaign_limit, budget_limit
    ) VALUES (
      ${sqlStr(id)}::uuid,
      ${promo.limits.per_user},
      ${promo.limits.per_transaction},
      NULL,
      NULL,
      NULL
    )
    ON CONFLICT (promotion_id) DO UPDATE SET
      per_user = EXCLUDED.per_user,
      per_transaction = EXCLUDED.per_transaction,
      updated_at = NOW()
  `);
  return id;
}

async function evaluateApi(payload) {
  const res = await fetch(`${DEV_API}/promo-engine/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function runEvaluateTests() {
  const cases = [
    {
      name: 'new customer vet booking 699',
      expectEligible: true,
      expectMinDiscount: 80,
      body: {
        user_id: '00000000-0000-4000-8000-devgv000001',
        transaction: { type: 'BOOKING', service_category: 'VET', amount: 699 },
        behaviour_override: { overall: {}, services: {} },
      },
    },
    {
      name: 'new customer grooming booking 800',
      expectEligible: true,
      expectMinDiscount: 150,
      body: {
        user_id: '00000000-0000-4000-8000-devgv000002',
        transaction: { type: 'BOOKING', service_category: 'grooming', amount: 800 },
        behaviour_override: { overall: {}, services: {} },
      },
    },
    {
      name: 'walk-in vet Pay Bill 1000',
      expectEligible: true,
      expectMinDiscount: 90,
      body: {
        user_id: '00000000-0000-4000-8000-devgv000003',
        transaction: { type: 'WPAY', service_category: 'veterinary', amount: 1000 },
        behaviour_override: { overall: {}, services: {} },
      },
    },
    {
      name: 'booked grooming then Pay Bill 1000',
      expectEligible: true,
      expectMinDiscount: 70,
      body: {
        user_id: '00000000-0000-4000-8000-devgv000004',
        transaction: { type: 'WPAY', service_category: 'grooming', amount: 1000 },
        behaviour_override: { overall: {}, services: {} },
      },
    },
    {
      name: 'vet tele 500',
      expectEligible: true,
      expectMinDiscount: 50,
      body: {
        user_id: '00000000-0000-4000-8000-devgv000005',
        transaction: {
          type: 'BOOKING',
          service_category: 'veterinary',
          service_type: 'tele',
          amount: 500,
        },
        behaviour_override: { overall: {}, services: {} },
      },
    },
    {
      name: 'vet second visit 800',
      expectEligible: true,
      expectMinDiscount: 100,
      body: {
        user_id: '00000000-0000-4000-8000-devgv000006',
        transaction: { type: 'BOOKING', service_category: 'veterinary', amount: 800 },
        behaviour_override: {
          overall: {},
          services: { veterinary: { completed_count: 1 } },
        },
      },
    },
  ];

  let failed = 0;
  for (const testCase of cases) {
    const { status, json } = await evaluateApi(testCase.body);
    const discount = Number(json?.summary?.discount ?? json?.data?.summary?.discount ?? 0);
    const eligible = Boolean(json?.eligible ?? json?.data?.eligible);
    const ok =
      status === 200 &&
      eligible === testCase.expectEligible &&
      discount >= testCase.expectMinDiscount;
    if (!ok) failed += 1;
    console.log(
      `${ok ? 'PASS' : 'FAIL'} ${testCase.name} status=${status} eligible=${eligible} discount=${discount}`
    );
    if (!ok) {
      console.log('  body', JSON.stringify(json).slice(0, 400));
    }
  }
  return failed;
}

async function main() {
  requireDev();
  console.log(`\nDEV promo-engine grooming/vet seed (${PROMOS.length} rules)\n`);
  PROMOS.forEach((p) => {
    console.log(`  ${p.code.padEnd(24)} ${p.name}`);
  });

  if (!APPLY) {
    const existing = await listSeeded();
    console.log(`\nDry run. ${existing.length} DEV_GV_* rows already in RDS.`);
    console.log('Apply with: $env:ENVIRONMENT="dev"; node scripts/seed-dev-grooming-vet-promo-engine.js --apply --yes');
    if (RUN_TEST) {
      const failed = await runEvaluateTests();
      process.exit(failed ? 1 : 0);
    }
    return;
  }

  for (const promo of PROMOS) {
    const id = await upsertPromo(promo);
    console.log(`upserted ${promo.code} ${id}`);
  }

  const seeded = await listSeeded();
  console.log(`\nSeeded ${seeded.length} promotions:`);
  console.table(seeded);

  if (seeded.length !== PROMOS.length) {
    throw new Error(`Expected ${PROMOS.length} DEV_GV_* rows, found ${seeded.length}`);
  }

  if (RUN_TEST) {
    const failed = await runEvaluateTests();
    if (failed) process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
