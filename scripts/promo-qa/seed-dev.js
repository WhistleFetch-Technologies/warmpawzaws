/**
 * DEV ONLY: seed promo-engine promotions (visit loops + bill-amount ranges) from a JSON spec,
 * in the same row shape the admin promo builder saves. Workflow: .cursor/rules/promo-engine-dev-qa.mdc
 *
 *   node scripts/promo-qa/seed-dev.js <spec.json> [--dry-run]   create missing promos (existing codes are skipped)
 *   node scripts/promo-qa/seed-dev.js <spec.json> --replace     archive this spec's promos, then create them fresh
 *   node scripts/promo-qa/seed-dev.js <spec.json> --archive     archive this spec's promos (no delete)
 *   node scripts/promo-qa/seed-dev.js --list                    QA- promos live on dev, with their ranges
 *   node scripts/promo-qa/seed-dev.js --vendors <name>          find a dev vendor id for the spec
 *
 * Needs AWS credentials for the dev RDS Data API (e.g. AWS_PROFILE=cursor-agent).
 */
const path = require('path');
const { CODE_PREFIX, assertDev, benefitList, die, json, lit, loadSpec, modeOf, num, quietQuery } = require('./lib');

assertDev();
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const DRY_RUN = flag('--dry-run');
const q = quietQuery();

function defaultEndAt() {
  return new Date(Date.now() + 30 * 86400000).toISOString();
}

function buildPromo(p, spec) {
  const d = spec.defaults;
  const channels = p.channels || d.channels;
  const vendorScope = { vendorId: spec.vendorId, vendorIds: [spec.vendorId] };
  const visitLetter = p.visitSource?.letter || 'F';
  const expiry = d.expiryDays ?? 30;

  const ranges = (p.ranges || [])
    .map((r) => ({
      label: r.label || null,
      min: r.min ?? null,
      max: r.max ?? null,
      active: r.active !== false,
      benefits: benefitList(r.discount, r.cashback, expiry),
      limits: r.limits || {},
      customerCopy: r.customerCopy || null,
    }))
    .sort((a, b) => (a.min ?? 0) - (b.min ?? 0));
  const single = ranges.length ? null : benefitList(p.discount, p.cashback, expiry);
  const allBenefits = single || ranges.flatMap((r) => r.benefits);
  const firstCashback = allBenefits.find((b) => b.type === 'CASHBACK');

  const vcf = {
    visitSource: {
      width: 'specific',
      letter: visitLetter,
      channels: p.visitSource?.channels || channels,
      countMode: 'pooled',
      ...(visitLetter === 'V' ? vendorScope : {}),
    },
    visitLoop: p.visitLoop,
    benefitMode: modeOf(allBenefits),
    publish: { letter: 'V', ...vendorScope, channels },
    ...(firstCashback ? { redeem: { letter: 'F', channels }, expiryDays: firstCashback.expiryDays } : {}),
  };
  if (single) {
    const disc = single.find((b) => b.type === 'DISCOUNT');
    const cap = p.discount?.max ?? (disc?.mode === 'FIXED' ? disc.value : undefined);
    if (cap != null) vcf.maxDiscount = cap;
  }
  return { vcf, single, ranges };
}

async function findByCode(code) {
  const rows = await q(`SELECT id, status FROM promo_engine_promotions WHERE code = ${lit(code)} LIMIT 1`);
  return rows[0] || null;
}

async function audit(promotionId, payload) {
  await q(`INSERT INTO promo_engine_audit_log (promotion_id, event_type, payload)
           VALUES (${lit(promotionId)}::uuid, 'STATUS_CHANGED', ${json({ ...payload, source: 'promo-qa/seed-dev' })})`);
}

/** Code is UNIQUE even for archived rows, so archiving frees it with a suffix. */
async function archive(code) {
  const row = await findByCode(code);
  if (!row) return console.log(`ARCHIVE-SKIP ${code} not on dev`);
  if (DRY_RUN) return console.log(`DRY archive ${code} (${row.id})`);
  const archivedCode = `${code}~arch-${Date.now().toString(36)}`;
  await q(`UPDATE promo_engine_promotions
           SET status = 'ARCHIVED', code = ${lit(archivedCode)}, updated_at = NOW()
           WHERE id = ${lit(row.id)}::uuid`);
  await audit(row.id, { to: 'ARCHIVED', from: row.status, code });
  console.log(`ARCHIVED ${code} (${row.id})`);
}

async function insertRule(promotionId, benefits, range, sortOrder) {
  const r = range || {};
  const l = r.limits || {};
  await q(`INSERT INTO promo_engine_rules (
             promotion_id, condition_json, benefit_json, rule_type, priority, is_active,
             label, sort_order, min_amount, max_amount, benefit_mode, customer_copy,
             per_user_limit, daily_limit, campaign_limit, budget_limit)
           VALUES (
             ${lit(promotionId)}::uuid, ${json({ operator: 'AND', conditions: [] })}, ${json(benefits)},
             'CUSTOMER_JOURNEY', 100, ${range ? (r.active ? 'true' : 'false') : 'true'},
             ${lit(r.label)}, ${range ? num(sortOrder) : 'NULL'}, ${num(r.min)}, ${num(r.max)},
             ${lit(range ? modeOf(benefits) : null)}, ${r.customerCopy ? json(r.customerCopy) : 'NULL'},
             ${num(l.perUser)}, ${num(l.dailyLimit)}, ${num(l.campaignLimit)}, ${num(l.budgetLimit)})`);
}

async function seed(p, spec) {
  const existing = await findByCode(p.code);
  if (existing) return console.log(`SKIP ${p.code} exists (${existing.id}, ${existing.status}); use --replace to recreate`);
  const built = buildPromo(p, spec);
  const limits = p.limits || {};
  if (DRY_RUN) return console.log(`DRY ${p.code} ${JSON.stringify({ ...built, limits }, null, 2)}`);

  const metadata = {
    vcf: built.vcf,
    ...(p.customerCopy ? { customerCopy: p.customerCopy } : {}),
    qa: { spec: path.basename(spec.file), seededAt: new Date().toISOString() },
  };
  const [promo] = await q(`
    INSERT INTO promo_engine_promotions
      (name, code, status, priority, start_at, end_at, stacking_policy, funding_type,
       budget_limit, service_categories, metadata)
    VALUES (${lit(p.name || p.code)}, ${lit(p.code)}, ${lit(p.status || 'ACTIVE')}, ${num(p.priority ?? 70)},
            NOW(), ${lit(p.endAt || spec.defaults.endAt || defaultEndAt())}::timestamptz,
            'DISCOUNT_WITH_CASHBACK', 'WARMPAWZ', ${num(limits.budgetLimit)}, '{}'::text[], ${json(metadata)})
    RETURNING id`);
  const id = promo.id;

  if (built.single) await insertRule(id, built.single, null, null);
  for (const [i, r] of built.ranges.entries()) await insertRule(id, r.benefits, r, i + 1);

  await q(`INSERT INTO promo_engine_limits (promotion_id, per_user, per_transaction, daily_limit, campaign_limit, budget_limit)
           VALUES (${lit(id)}::uuid, ${num(limits.perUser)}, ${num(limits.perTransaction)}, ${num(limits.dailyLimit)},
                   ${num(limits.campaignLimit)}, ${num(limits.budgetLimit)})`);
  await audit(id, { to: p.status || 'ACTIVE', action: 'CREATE' });
  console.log(`CREATED ${p.code} ${id} (${built.ranges.length ? `${built.ranges.length} ranges` : 'single offer'})`);
}

async function list() {
  const rows = await q(`
    SELECT p.code, p.status, p.id::text AS id, p.priority, p.metadata->'vcf'->'visitLoop' AS loop,
           r.label, r.min_amount, r.max_amount, r.is_active, r.benefit_json, r.budget_consumed
    FROM promo_engine_promotions p
    LEFT JOIN promo_engine_rules r ON r.promotion_id = p.id AND r.archived_at IS NULL
    WHERE p.code LIKE ${lit(`${CODE_PREFIX}%`)} AND p.status <> 'ARCHIVED'
    ORDER BY p.code, r.sort_order NULLS LAST, r.min_amount NULLS FIRST`);
  if (!rows.length) return console.log('No live QA- promos on dev.');
  let last = '';
  for (const r of rows) {
    if (r.code !== last) {
      console.log(`\n${r.code}  ${r.status}  priority ${r.priority}  loop ${r.loop}  ${r.id}`);
      last = r.code;
    }
    const bounds = r.min_amount == null && r.max_amount == null ? 'any amount' : `${r.min_amount ?? 0} - ${r.max_amount ?? 'open'}`;
    console.log(`   ${r.label || '-'} | ${bounds} | ${r.is_active ? 'on' : 'OFF'} | ${r.benefit_json} | used ${r.budget_consumed ?? 0}`);
  }
}

async function vendors(term) {
  const rows = await q(`
    SELECT v.id::text AS id, v.business_name
    FROM vendors v
    WHERE v.is_deleted IS NOT TRUE ${term ? `AND v.business_name ILIKE ${lit(`%${term}%`)}` : ''}
    ORDER BY v.business_name
    LIMIT 20`);
  for (const r of rows) console.log(`${r.id}  ${r.business_name}`);
  if (!rows.length) console.log('No vendors matched.');
}

(async () => {
  try {
    if (flag('--list')) return await list();
    if (flag('--vendors')) return await vendors(args[args.indexOf('--vendors') + 1]);
    const spec = loadSpec(args.find((a) => !a.startsWith('--')));
    if (flag('--archive') || flag('--replace')) {
      for (const p of spec.promos) await archive(p.code);
      if (flag('--archive')) return;
    }
    for (const p of spec.promos) await seed(p, spec);
  } catch (e) {
    die(e.message);
  }
})();
