/**
 * Seed ecommerce Promotion Engine rules on DEV via RDS Data API.
 *
 * Usage (PowerShell):
 *   $env:ENVIRONMENT='dev'; node scripts/seed-dev-ecommerce-promo-engine.js --apply --yes --test
 *
 * Idempotent on code (DEV_EC_*). Dev only.
 */
const { query, executeSQL } = require('./rds-data-api-utils-dev');

const ENVIRONMENT = (process.env.ENVIRONMENT || 'dev').toLowerCase();
const APPLY = process.argv.includes('--apply');
const YES = process.argv.includes('--yes');
const RUN_TEST = process.argv.includes('--test');
const DEV_API =
  process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

function sqlStr(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}
function sqlJson(value) {
  return `${sqlStr(JSON.stringify(value))}::jsonb`;
}
function sqlTextArray(values) {
  return `ARRAY[${values.map(sqlStr).join(', ')}]::text[]`;
}
function andConditions(extra) {
  return {
    operator: 'AND',
    conditions: [
      { field: 'transaction.service_category', operator: '=', value: 'ecommerce' },
      ...extra,
    ],
  };
}

const PROMOS = [
  {
    code: 'DEV_EC_FIRST',
    name: 'Shop first order 15% + ₹50 cashback',
    priority: 90,
    stacking: 'DISCOUNT_WITH_CASHBACK',
    condition: andConditions([{ field: 'user.ecommerce_visit_count', operator: '=', value: 0 }]),
    benefits: [
      { type: 'DISCOUNT', mode: 'PERCENT', value: 15, maxAmount: 250 },
      { type: 'CASHBACK', mode: 'FIXED', value: 50, expiryDays: 30, redeemScope: ['ecommerce', 'shop'] },
    ],
    limits: { per_user: 1, per_transaction: 1 },
  },
  {
    code: 'DEV_EC_SECOND',
    name: 'Shop second order ₹80 off',
    priority: 82,
    stacking: 'NONE',
    condition: andConditions([{ field: 'user.ecommerce_visit_count', operator: '=', value: 1 }]),
    benefits: [{ type: 'DISCOUNT', mode: 'FIXED', value: 80 }],
    limits: { per_user: 1, per_transaction: 1 },
  },
  {
    code: 'DEV_EC_MIN799',
    name: 'Shop ₹799+ 10% off',
    priority: 70,
    stacking: 'NONE',
    condition: andConditions([{ field: 'transaction.amount', operator: '>=', value: 799 }]),
    benefits: [{ type: 'DISCOUNT', mode: 'PERCENT', value: 10, maxAmount: 200 }],
    limits: { per_user: 8, per_transaction: 1 },
  },
  {
    code: 'DEV_EC_MIN1499',
    name: 'Shop ₹1499+ 12% off',
    priority: 72,
    stacking: 'NONE',
    condition: andConditions([{ field: 'transaction.amount', operator: '>=', value: 1499 }]),
    benefits: [{ type: 'DISCOUNT', mode: 'PERCENT', value: 12, maxAmount: 350 }],
    limits: { per_user: 6, per_transaction: 1 },
  },
  {
    code: 'DEV_EC_CASHBACK',
    name: 'Shop every order ₹30 cashback',
    priority: 40,
    stacking: 'DISCOUNT_WITH_CASHBACK',
    condition: andConditions([{ field: 'user.ecommerce_visit_count', operator: '>=', value: 0 }]),
    benefits: [
      { type: 'CASHBACK', mode: 'FIXED', value: 30, expiryDays: 30, redeemScope: ['ecommerce'] },
    ],
    limits: { per_user: 20, per_transaction: 1 },
  },
  {
    code: 'DEV_EC_LOYAL5',
    name: 'Shop 5+ orders 8% + ₹40 cashback',
    priority: 68,
    stacking: 'DISCOUNT_WITH_CASHBACK',
    condition: andConditions([{ field: 'user.ecommerce_visit_count', operator: '>=', value: 5 }]),
    benefits: [
      { type: 'DISCOUNT', mode: 'PERCENT', value: 8, maxAmount: 180 },
      { type: 'CASHBACK', mode: 'FIXED', value: 40, expiryDays: 30, redeemScope: ['ecommerce'] },
    ],
    limits: { per_user: 6, per_transaction: 1 },
  },
  {
    code: 'DEV_EC_WINBACK',
    name: 'Shop winback 30 days 18% off',
    priority: 66,
    stacking: 'NONE',
    condition: andConditions([
      { field: 'user.ecommerce_visit_count', operator: '>=', value: 1 },
      { field: 'user.days_since_last_ecommerce', operator: '>=', value: 30 },
    ]),
    benefits: [{ type: 'DISCOUNT', mode: 'PERCENT', value: 18, maxAmount: 300 }],
    limits: { per_user: 1, per_transaction: 1 },
  },
  {
    code: 'DEV_EC_EVERY3',
    name: 'Shop every 3rd order 12% off',
    priority: 64,
    stacking: 'NONE',
    condition: andConditions([
      {
        field: 'user.ecommerce_visit_count',
        operator: '%',
        value: { divisor: 3, remainder: 0, offset: 1 },
      },
    ]),
    benefits: [{ type: 'DISCOUNT', mode: 'PERCENT', value: 12, maxAmount: 220 }],
    limits: { per_user: 12, per_transaction: 1 },
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
      ${sqlTextArray(['ecommerce'])},
      ${sqlJson({ seed: 'dev-ecommerce-2026-09', code: promo.code })},
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
      'CUSTOMER_JOURNEY',
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
      NULL, NULL, NULL
    )
    ON CONFLICT (promotion_id) DO UPDATE SET
      per_user = EXCLUDED.per_user,
      per_transaction = EXCLUDED.per_transaction,
      updated_at = NOW()
  `);
  return id;
}

async function listSeeded() {
  return query(`
    SELECT p.code, p.name, p.status, p.priority
    FROM promo_engine_promotions p
    WHERE p.code LIKE 'DEV_EC_%'
    ORDER BY p.priority DESC, p.code
  `);
}

async function runEvaluateTests() {
  const cases = [
    {
      name: 'first shop cart 600',
      minDiscount: 80,
      body: {
        user_id: '00000000-0000-4000-8000-devec000001',
        transaction: { type: 'ECOMMERCE', service_category: 'shop', amount: 600 },
        behaviour_override: { overall: {}, services: {} },
      },
    },
    {
      name: 'shop cart 1499',
      minDiscount: 170,
      body: {
        user_id: '00000000-0000-4000-8000-devec000002',
        transaction: { type: 'ECOMMERCE', service_category: 'ecommerce', amount: 1499 },
        behaviour_override: { overall: {}, services: {} },
      },
    },
  ];
  let failed = 0;
  for (const testCase of cases) {
    const res = await fetch(`${DEV_API}/promo-engine/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testCase.body),
    });
    const json = await res.json().catch(() => ({}));
    const discount = Number(json?.summary?.discount ?? json?.data?.summary?.discount ?? 0);
    const eligible = Boolean(json?.eligible ?? json?.data?.eligible);
    const ok = res.status === 200 && eligible && discount >= testCase.minDiscount;
    if (!ok) failed += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${testCase.name} status=${res.status} discount=${discount}`);
  }
  return failed;
}

async function main() {
  requireDev();
  console.log(`\nDEV ecommerce promo seed (${PROMOS.length} rules)\n`);
  if (!APPLY) {
    console.log('Dry run. Apply with --apply --yes');
    if (RUN_TEST) process.exit((await runEvaluateTests()) ? 1 : 0);
    return;
  }
  for (const promo of PROMOS) {
    console.log(`upserted ${promo.code} ${await upsertPromo(promo)}`);
  }
  const seeded = await listSeeded();
  console.table(seeded);
  if (seeded.length !== PROMOS.length) {
    throw new Error(`Expected ${PROMOS.length} DEV_EC_* rows, found ${seeded.length}`);
  }
  if (RUN_TEST && (await runEvaluateTests())) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
