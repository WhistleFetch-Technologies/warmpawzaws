/**
 * DEV ONLY. Copy prod Pay Bill visit-range ladders (PB-LADDER-*) onto dev.
 * Reads scripts/promo-qa/.out/promo-dump-prod.json (create with _dump-env-promos.js).
 * Never writes to prod.
 *
 *   $env:ENVIRONMENT='dev'; node scripts/promo-qa/seed-prod-ladders-dev.js --apply --yes
 */
const fs = require('fs');
const path = require('path');

const env = String(process.env.ENVIRONMENT || 'dev').toLowerCase();
if (env !== 'dev') {
  console.error('Refusing to run unless ENVIRONMENT=dev');
  process.exit(1);
}
process.env.ENVIRONMENT = 'dev';

const APPLY = process.argv.includes('--apply');
const YES = process.argv.includes('--yes');
const { query, executeSQL } = require('../rds-data-api-utils-dev');

const DUMP = path.join(__dirname, '.out', 'promo-dump-prod.json');
const LADDER_CODES = [
  'PB-LADDER-V1',
  'PB-LADDER-V2',
  'PB-LADDER-V3',
  'PB-LADDER-V4',
  'PB-LADDER-V5',
  'PB-LADDER-V6PLUS',
];
const PAUSE_QA_CODES = ['QA-PLAT-V1', 'QA-PLAT-V2', 'QA-PLAT-V3'];

function sqlStr(value) {
  if (value == null) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}
function sqlJson(value) {
  return `${sqlStr(JSON.stringify(value))}::jsonb`;
}
function sqlNum(value) {
  if (value == null || value === '') return 'NULL';
  const n = Number(value);
  if (!Number.isFinite(n)) return 'NULL';
  return String(n);
}

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

async function pauseQaPlat() {
  for (const code of PAUSE_QA_CODES) {
    const rows = await query(
      `SELECT id::text AS id, status FROM promo_engine_promotions WHERE code = ${sqlStr(code)} LIMIT 1`,
    );
    const row = rows[0];
    if (!row) {
      console.log(`PAUSE-SKIP ${code} not on dev`);
      continue;
    }
    if (row.status === 'PAUSED' || row.status === 'ARCHIVED') {
      console.log(`PAUSE-OK ${code} already ${row.status}`);
      continue;
    }
    if (!APPLY) {
      console.log(`DRY pause ${code} (${row.status} → PAUSED)`);
      continue;
    }
    await executeSQL(
      `UPDATE promo_engine_promotions SET status = 'PAUSED', updated_at = NOW() WHERE id = ${sqlStr(row.id)}::uuid`,
    );
    console.log(`PAUSED ${code} so prod ladders can win`);
  }
}

async function upsertLadder(promo, rules, limits) {
  const metadata = {
    vcf: promo.metadata && promo.metadata.vcf ? promo.metadata.vcf : {},
    seed: 'seed-prod-ladders-dev',
    mirroredFrom: 'prod',
    mirroredAt: new Date().toISOString(),
  };
  const liveRules = rules
    .filter((r) => r.promotion_id === promo.id && !r.archived_at)
    .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
  const lim = limits.find((l) => l.promotion_id === promo.id) || {};
  const budget = lim.budget_limit != null ? lim.budget_limit : promo.budget_limit;

  if (!APPLY) {
    console.log(`DRY ${promo.code} ranges=${liveRules.length} budget=${budget}`);
    return;
  }

  const upserted = await query(`
    INSERT INTO promo_engine_promotions (
      code, name, status, priority, start_at, end_at,
      stacking_policy, funding_type, funding_split,
      budget_limit, service_categories, metadata, updated_at
    ) VALUES (
      ${sqlStr(promo.code)},
      ${sqlStr(promo.name)},
      'ACTIVE',
      ${sqlNum(promo.priority ?? 50)},
      NOW() - INTERVAL '1 hour',
      NOW() + INTERVAL '90 days',
      ${sqlStr(promo.stacking_policy || 'DISCOUNT_WITH_CASHBACK')},
      ${sqlStr(promo.funding_type || 'WARMPAWZ')},
      ${promo.funding_split ? sqlJson(promo.funding_split) : 'NULL'},
      ${sqlNum(budget)},
      '{}'::text[],
      ${sqlJson(metadata)},
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
      budget_limit = EXCLUDED.budget_limit,
      service_categories = EXCLUDED.service_categories,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
    RETURNING id::text AS id, code
  `);
  const id = upserted[0] && upserted[0].id;
  if (!id) throw new Error(`No id for ${promo.code}`);

  await executeSQL(
    `UPDATE promo_engine_rules SET archived_at = NOW()
     WHERE promotion_id = ${sqlStr(id)}::uuid AND archived_at IS NULL`,
  );
  for (const r of liveRules) {
    await executeSQL(`
      INSERT INTO promo_engine_rules (
        promotion_id, condition_json, benefit_json, rule_type, priority, is_active,
        label, sort_order, min_amount, max_amount, benefit_mode, customer_copy,
        per_user_limit, daily_limit, campaign_limit, budget_limit
      ) VALUES (
        ${sqlStr(id)}::uuid,
        ${sqlJson(r.condition_json || { operator: 'AND', conditions: [] })},
        ${sqlJson(asArray(r.benefit_json))},
        ${sqlStr(r.rule_type || 'CUSTOMER_JOURNEY')},
        ${sqlNum(r.priority ?? 100)},
        ${r.is_active === false ? 'false' : 'true'},
        ${sqlStr(r.label)},
        ${sqlNum(r.sort_order)},
        ${sqlNum(r.min_amount)},
        ${sqlNum(r.max_amount)},
        ${sqlStr(r.benefit_mode)},
        ${r.customer_copy ? sqlJson(r.customer_copy) : 'NULL'},
        ${sqlNum(r.per_user_limit)},
        ${sqlNum(r.daily_limit)},
        ${sqlNum(r.campaign_limit)},
        ${sqlNum(r.budget_limit)}
      )
    `);
  }

  await executeSQL(`
    INSERT INTO promo_engine_limits (promotion_id, per_user, per_transaction, daily_limit, campaign_limit, budget_limit)
    VALUES (${sqlStr(id)}::uuid, ${sqlNum(lim.per_user)}, ${sqlNum(lim.per_transaction)},
            ${sqlNum(lim.daily_limit)}, ${sqlNum(lim.campaign_limit)}, ${sqlNum(budget)})
    ON CONFLICT (promotion_id) DO UPDATE SET
      per_user = EXCLUDED.per_user,
      per_transaction = EXCLUDED.per_transaction,
      daily_limit = EXCLUDED.daily_limit,
      campaign_limit = EXCLUDED.campaign_limit,
      budget_limit = EXCLUDED.budget_limit
  `);
  console.log(`SEEDED ${promo.code} ${id} ranges=${liveRules.length}`);
}

(async () => {
  if (APPLY && !YES) {
    console.error('Refusing --apply without --yes');
    process.exit(1);
  }
  if (!fs.existsSync(DUMP)) {
    console.error(`Missing ${DUMP}. Run ENVIRONMENT=prod node scripts/promo-qa/_dump-env-promos.js first.`);
    process.exit(1);
  }
  const dump = JSON.parse(fs.readFileSync(DUMP, 'utf8'));
  if (dump.environment !== 'prod') {
    console.error('Dump file is not from prod');
    process.exit(1);
  }
  await pauseQaPlat();
  for (const code of LADDER_CODES) {
    const promo = dump.promotions.find((p) => p.code === code);
    if (!promo) {
      console.error(`Missing ${code} in prod dump`);
      process.exit(1);
    }
    await upsertLadder(promo, dump.rules, dump.limits);
  }
  const check = await query(`
    SELECT p.code, p.status, p.priority, COUNT(r.id)::int AS ranges
    FROM promo_engine_promotions p
    LEFT JOIN promo_engine_rules r ON r.promotion_id = p.id AND r.archived_at IS NULL
    WHERE p.code LIKE 'PB-LADDER-%' OR p.code LIKE 'QA-PLAT-%'
    GROUP BY p.code, p.status, p.priority
    ORDER BY p.code
  `);
  for (const row of check) console.log(`CHECK ${row.code} ${row.status} pri=${row.priority} ranges=${row.ranges}`);
})().catch((e) => {
  console.error('ERR', e.message || e);
  process.exit(1);
});
